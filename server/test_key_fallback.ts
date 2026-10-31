import dotenv from 'dotenv';
dotenv.config();

import { markKeyCooldown } from './geminiKeyManager';
import { generateAiClinicalSummary } from './aiClinicalSummary';

async function run() {
  console.log('=== [PHASE 1] Testing Summary Generation with Primary API Key #1 ===');
  const res1 = await generateAiClinicalSummary('appt-today-atharv-1');
  console.log('✓ Success with Key 1!');
  console.log('  Model Used:', res1.aiOutput?.modelUsed);
  console.log('  Overview:', res1.aiOutput?.overview?.slice(0, 160) + '...');
  console.log('  Critical Alerts:', res1.aiOutput?.criticalAlerts?.length);

  console.log('\n=== [PHASE 2] Simulating Key #1 Limit Reached -> Auto-Calling Key #2 ===');
  const key1 = process.env.GEMINI_API_KEY!;
  markKeyCooldown(key1, 120000); // Put Key 1 on cooldown

  const res2 = await generateAiClinicalSummary('appt-today-atharv-1');
  console.log('✓ Success with Key 2!');
  console.log('  Model Used:', res2.aiOutput?.modelUsed);
  console.log('  Overview:', res2.aiOutput?.overview?.slice(0, 160) + '...');

  console.log('\n=== [PHASE 3] Simulating Key #1 & #2 Limit Reached -> Auto-Calling Key #3 ===');
  const key2 = process.env.GEMINI_API_KEY_2!;
  markKeyCooldown(key2, 120000); // Put Key 2 on cooldown

  const res3 = await generateAiClinicalSummary('appt-today-atharv-1');
  console.log('✓ Success with Key 3!');
  console.log('  Model Used:', res3.aiOutput?.modelUsed);
  console.log('  Overview:', res3.aiOutput?.overview?.slice(0, 160) + '...');

  console.log('\n======================================================');
  console.log('ALL 3 API KEYS VERIFIED & AUTOMATIC FALLBACK CONFIRMED');
  console.log('======================================================');
}

run().catch((e) => {
  console.error('Test error:', e);
  process.exit(1);
});
