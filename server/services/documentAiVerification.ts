import { z } from 'zod';
import { PDFParse } from 'pdf-parse';
import { executeWithKeyFallback } from '../geminiKeyManager';

// ============================================================================
// Schemas & Types
// ============================================================================

export const ExtractedFieldsSchema = z.object({
  patientName: z.string().nullable().optional(),
  issuer: z.string().nullable().optional(),
  documentDate: z.string().nullable().optional(),
  documentType: z.string().nullable().optional(),
  readable: z.boolean(),
  categoryMatches: z.boolean(),
  metadataMatches: z.boolean(),
  summary: z.string(),
  reason: z.string().optional(),
});
export type ExtractedFields = z.infer<typeof ExtractedFieldsSchema>;

export const DocumentVerificationInputSchema = z.object({
  fileBuffer: z.instanceof(Buffer),
  fileName: z.string().min(1).max(255),
  mimeType: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
  category: z.string().min(1),
  title: z.string().min(1).max(200),
  issuer: z.string().min(1).max(200),
  recordDate: z.string().min(1),
  expectedPatientName: z.string().min(1),
  expectedPatientDob: z.string().optional(),
  timeoutMs: z.number().int().positive().optional(),
  minConfidence: z.number().min(0).max(1).optional(),
});
export type DocumentVerificationInput = z.infer<typeof DocumentVerificationInputSchema>;

export const DocumentVerificationResultSchema = z.object({
  status: z.enum(['AI_VERIFIED', 'DOCTOR_REVIEW_REQUIRED']),
  method: z.literal('AI'),
  confidence: z.number().min(0).max(1),
  extractedFields: ExtractedFieldsSchema,
  verifiedAt: z.date().nullable(),
  auditLog: z.string(),
});
export type DocumentVerificationResult = z.infer<typeof DocumentVerificationResultSchema>;

export interface DocumentVerificationProvider {
  name: string;
  verify(input: DocumentVerificationInput): Promise<DocumentVerificationResult>;
}

// ============================================================================
// Text Extraction Utilities
// ============================================================================

export async function extractTextFromBuffer(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType !== 'application/pdf') {
    return '';
  }

  try {
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    if (parsed?.text && parsed.text.trim().length > 10) {
      return cleanText(parsed.text);
    }
  } catch {
    // Fallback to regex stream parsing
  }

  try {
    const content = buffer.toString('binary');
    const textMatches: string[] = [];
    const streamRegex = /BT([\s\S]*?)ET/g;
    let match: RegExpExecArray | null;

    while ((match = streamRegex.exec(content)) !== null) {
      const block = match[1];
      const tjRegex = /\((.*?)\)\s*Tj/g;
      let tjMatch: RegExpExecArray | null;
      while ((tjMatch = tjRegex.exec(block)) !== null) {
        textMatches.push(tjMatch[1]);
      }
    }

    if (textMatches.length > 0) {
      return cleanText(textMatches.join('\n'));
    }
  } catch {
    // Ignore stream regex error
  }

  // Fallback: extract printable alphanumeric text runs from buffer
  try {
    const rawStr = buffer.toString('utf8');
    const printableMatches = rawStr.match(/[A-Za-z0-9\s:,\.\-\/]{20,}/g);
    if (printableMatches && printableMatches.length > 0) {
      return cleanText(printableMatches.join('\n'));
    }
  } catch {
    // Ignore buffer read error
  }

  return '';
}

function cleanText(raw: string): string {
  return raw
    .replace(/-- \d+ of \d+ --/g, '')
    .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
    .slice(0, 4000);
}

// ============================================================================
// Rule-Based Verification Engine (Offline & Fallback Provider)
// ============================================================================

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  LAB_REPORT: ['lab', 'test', 'blood', 'cbc', 'hemoglobin', 'serum', 'glucose', 'cholesterol', 'pathology', 'urine', 'specimen', 'result', 'reference', 'profile', 'platelet', 'wbc', 'rbc', 'lipid', 'thyroid'],
  PRESCRIPTION: ['rx', 'prescription', 'mg', 'tablet', 'tab', 'capsule', 'syrup', 'dosage', 'daily', 'dr.', 'doctor', 'sig', 'pharma', 'dispense', 'intake', 'bd', 'od', 'sos'],
  IMAGING: ['x-ray', 'scan', 'mri', 'ct', 'ultrasound', 'imaging', 'radiology', 'view', 'impression', 'echocardiogram', 'echo', 'chest', 'contrast', 'film'],
  DISCHARGE_SUMMARY: ['discharge', 'admission', 'hospital', 'admitted', 'course', 'diagnosis', 'condition', 'treatment', 'consultant', 'ward', 'history'],
  OTHER: ['medical', 'report', 'health', 'clinic', 'hospital', 'patient', 'doctor'],
};

export class RuleBasedVerificationProvider implements DocumentVerificationProvider {
  name = 'RuleBasedVerificationEngine';

  async verify(input: DocumentVerificationInput): Promise<DocumentVerificationResult> {
    const startTime = Date.now();
    const text = await extractTextFromBuffer(input.fileBuffer, input.mimeType);
    const textLower = text.toLowerCase();

    // 1. Readability Check
    const isReadable = text.length >= 25;
    if (!isReadable) {
      return {
        status: 'DOCTOR_REVIEW_REQUIRED',
        method: 'AI',
        confidence: 0.35,
        extractedFields: {
          patientName: null,
          issuer: null,
          documentDate: null,
          documentType: input.category,
          readable: false,
          categoryMatches: false,
          metadataMatches: false,
          summary: 'Document file has limited machine-readable text or is a scanned image without OCR. Preserved for clinical doctor review.',
          reason: 'Insufficient readable textual content for automated validation.',
        },
        verifiedAt: null,
        auditLog: `[${this.name}] File "${input.fileName}" lacked machine-readable text. Routed to doctor review in ${Date.now() - startTime}ms.`,
      };
    }

    // 2. Category Keyword Compatibility
    const targetKeywords = CATEGORY_KEYWORDS[input.category] || CATEGORY_KEYWORDS.OTHER;
    const matchedCategoryKeywords = targetKeywords.filter((kw) => textLower.includes(kw));
    const categoryMatches = matchedCategoryKeywords.length >= 2 || (input.category === 'OTHER' && matchedCategoryKeywords.length >= 1);

    // 3. Patient Name Check
    const nameParts = input.expectedPatientName
      .toLowerCase()
      .split(/\s+/)
      .filter((part) => part.length >= 3);
    const matchedNameParts = nameParts.filter((part) => textLower.includes(part));
    const patientNameMatches = matchedNameParts.length > 0;

    // 4. Issuer Check
    const issuerParts = input.issuer
      .toLowerCase()
      .split(/\s+/)
      .filter((part) => part.length >= 3 && !['general', 'clinic', 'hospital', 'center'].includes(part));
    const matchedIssuerParts = issuerParts.filter((part) => textLower.includes(part));
    const issuerMatches = matchedIssuerParts.length > 0 || textLower.includes('hospital') || textLower.includes('clinic') || textLower.includes('lab');

    // 5. Date Extraction / Proximity
    const dateRegex = /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\b/;
    const dateMatch = text.match(dateRegex);
    const extractedDate = dateMatch ? dateMatch[0] : input.recordDate;

    // 6. Confidence Calculation
    let score = 0.15; // Base score for readable medical text
    if (categoryMatches) score += 0.35;
    if (issuerMatches) score += 0.20;
    if (patientNameMatches) score += 0.30;

    const confidence = Math.min(1.0, Math.round(score * 100) / 100);
    const metadataMatches = categoryMatches && patientNameMatches;
    const minConfidence = input.minConfidence ?? 0.80;
    const passed = confidence >= minConfidence && categoryMatches && patientNameMatches && isReadable;

    const status = passed ? 'AI_VERIFIED' : 'DOCTOR_REVIEW_REQUIRED';
    const summary = passed
      ? `Automated check verified: Document content matches category "${input.category}" and submitted clinical metadata.`
      : `Automated check identified discrepancies (confidence: ${Math.round(confidence * 100)}%). Routed to attending doctor for clinical review.`;

    return {
      status,
      method: 'AI',
      confidence,
      extractedFields: {
        patientName: patientNameMatches ? input.expectedPatientName : null,
        issuer: issuerMatches ? input.issuer : null,
        documentDate: extractedDate,
        documentType: input.category,
        readable: true,
        categoryMatches,
        metadataMatches,
        summary,
        reason: passed ? undefined : 'Confidence below verification threshold or metadata mismatch.',
      },
      verifiedAt: passed ? new Date() : null,
      auditLog: `[${this.name}] Verification completed for "${input.fileName}". Status: ${status}, Confidence: ${confidence}, Duration: ${Date.now() - startTime}ms.`,
    };
  }
}

// ============================================================================
// Google Gemini Verification Provider
// ============================================================================

export class GeminiVerificationProvider implements DocumentVerificationProvider {
  name = 'GeminiVerificationEngine';
  private apiKey: string;
  private fallbackEngine: RuleBasedVerificationProvider;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.fallbackEngine = new RuleBasedVerificationProvider();
  }

  async verify(input: DocumentVerificationInput): Promise<DocumentVerificationResult> {
    const startTime = Date.now();
    const text = await extractTextFromBuffer(input.fileBuffer, input.mimeType);

    if (!text || text.length < 25) {
      // If unreadable, fallback immediately to preserve the document
      return this.fallbackEngine.verify(input);
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), input.timeoutMs);

      const prompt = `You are a strict Healthcare Document Verification Assistant for ArogyaNexus.
Your role is to run automated format and metadata consistency checks on uploaded patient medical files.
IMPORTANT: You DO NOT provide medical advice and you DO NOT establish authentic legal provenance. You only verify whether the file content is readable and consistent with the user's submitted metadata.

Document metadata provided by patient:
- Title: "${input.title}"
- Category: "${input.category}"
- Expected Issuer: "${input.issuer}"
- Document Date: "${input.recordDate}"
- Expected Patient Name: "${input.expectedPatientName}"

Extracted document content:
${text.slice(0, 3000)}

Respond with STRICT JSON only matching this schema:
{
  "readable": boolean,
  "categoryMatches": boolean,
  "metadataMatches": boolean,
  "extractedPatientName": string | null,
  "extractedIssuer": string | null,
  "extractedDate": string | null,
  "documentType": string,
  "confidence": number, // between 0.0 and 1.0
  "summary": string,
  "reason": string | null
}`;

      const verificationExecution = await executeWithKeyFallback(
        async (apiKey) => {
          const models = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.8-flash'];
          let lastErr: any = null;
          for (const model of models) {
            try {
              const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  signal: controller.signal,
                  body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                      temperature: 0.1,
                      responseMimeType: 'application/json',
                    },
                  }),
                }
              );
              if (!res.ok) {
                const errText = await res.text();
                const isQuota = res.status === 429 || (res.status === 403 && /quota|resource_exhausted/i.test(errText));
                const err: any = new Error(`HTTP ${res.status}: ${errText.slice(0, 150)}`);
                err.status = res.status;
                err.isQuotaExceeded = isQuota;
                if (isQuota) throw err;
                lastErr = err;
                continue;
              }
              const data = await res.json();
              const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (!rawJson) throw new Error('Empty response from verification model');
              return { rawJson, model };
            } catch (mErr: any) {
              if (mErr.isQuotaExceeded) throw mErr;
              lastErr = mErr;
            }
          }
          throw lastErr || new Error('All models failed for verification');
        },
        { explicitKey: this.apiKey, operationName: 'Document Verification' }
      );

      clearTimeout(timer);
      const rawJson = verificationExecution.result.rawJson;

      const parsed = JSON.parse(rawJson);
      const confidence = typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5;
      const isReadable = Boolean(parsed.readable);
      const categoryMatches = Boolean(parsed.categoryMatches);
      const minConfidence = input.minConfidence ?? 0.80;
      const passed = confidence >= minConfidence && isReadable && categoryMatches;
      const status = passed ? 'AI_VERIFIED' : 'DOCTOR_REVIEW_REQUIRED';

      return {
        status,
        method: 'AI',
        confidence,
        extractedFields: {
          patientName: parsed.extractedPatientName || null,
          issuer: parsed.extractedIssuer || null,
          documentDate: parsed.extractedDate || input.recordDate,
          documentType: parsed.documentType || input.category,
          readable: isReadable,
          categoryMatches,
          metadataMatches: Boolean(parsed.metadataMatches),
          summary: parsed.summary || (passed ? 'Automated check verified metadata consistency.' : 'Discrepancies found; routed to doctor review.'),
          reason: parsed.reason || undefined,
        },
        verifiedAt: passed ? new Date() : null,
        auditLog: `[${this.name}] Gemini verified "${input.fileName}". Status: ${status}, Confidence: ${confidence}, Duration: ${Date.now() - startTime}ms.`,
      };
    } catch (err: any) {
      console.warn(`[GeminiVerification] Error or timeout (${err?.message}), falling back safely:`, err);
      // Resilient fallback: Never fail the upload, route through rule-based engine or doctor review
      return await this.fallbackEngine.verify(input);
    }
  }
}

// ============================================================================
// Service Dispatcher
// ============================================================================

export class DocumentVerificationService {
  private provider: DocumentVerificationProvider;

  constructor(customProvider?: DocumentVerificationProvider) {
    if (customProvider) {
      this.provider = customProvider;
    } else {
      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      if (apiKey && process.env.NODE_ENV === 'production') {
        this.provider = new GeminiVerificationProvider(apiKey);
      } else {
        this.provider = new RuleBasedVerificationProvider();
      }
    }
  }

  setProvider(provider: DocumentVerificationProvider) {
    this.provider = provider;
  }

  async verifyDocument(rawInput: unknown): Promise<DocumentVerificationResult> {
    const validated = DocumentVerificationInputSchema.parse(rawInput);

    // Enforce 10 MB limit
    if (validated.fileBuffer.length > 10 * 1024 * 1024) {
      throw new Error('Document file exceeds the maximum 10 MB limit.');
    }

    try {
      const result = await this.provider.verify(validated);
      // Validate output schema
      return DocumentVerificationResultSchema.parse(result);
    } catch (err: any) {
      console.error(`[DocumentVerificationService] Verification failed: ${err.message}. Routing safely to doctor review.`);
      return {
        status: 'DOCTOR_REVIEW_REQUIRED',
        method: 'AI',
        confidence: 0,
        extractedFields: {
          patientName: null,
          issuer: null,
          documentDate: null,
          documentType: validated.category,
          readable: false,
          categoryMatches: false,
          metadataMatches: false,
          summary: 'Verification service encountered an unexpected error. Document preserved for doctor review.',
          reason: err?.message || 'Verification execution failure',
        },
        verifiedAt: null,
        auditLog: `[DocumentVerificationService] Execution failure for "${validated.fileName}": ${err?.message}. Routed to doctor review.`,
      };
    }
  }
}

export const defaultDocumentVerificationService = new DocumentVerificationService();
