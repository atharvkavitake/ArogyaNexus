import { createPatientProfile, deletePatientProfile, getPatientProfiles, updatePatientProfile } from './patients';

function toFamilyMember(profile) {
  return {
    ...profile,
    relation: String(profile.relation).toUpperCase() === 'SELF' ? 'Self' : profile.relation,
    dob: profile.dateOfBirth ? new Date(profile.dateOfBirth).toISOString().slice(0, 10) : '',
    gender: profile.sex || '',
    bloodGroup: profile.bloodGroup || '',
    allergies: profile.allergies || [],
    completion: profile.completeness ?? 0,
  };
}

function toPatientProfile(member) {
  return {
    name: member.name.trim(),
    relation: member.relation === 'Self' ? 'SELF' : member.relation,
    dateOfBirth: member.dob || null,
    sex: member.gender || null,
    bloodGroup: member.bloodGroup || null,
    phone: member.phone || null,
    email: member.email || null,
    allergies: member.allergies || [],
  };
}

export async function getFamily(profileId) {
  return (await getPatientProfiles(profileId)).map(toFamilyMember);
}

export async function saveFamilyMember(ownerProfileId, member) {
  const payload = toPatientProfile(member);
  const saved = member.id
    ? await updatePatientProfile(member.id, payload)
    : await createPatientProfile(ownerProfileId, payload);
  return toFamilyMember(saved);
}

export async function deleteFamilyMember(_ownerProfileId, memberId) {
  return deletePatientProfile(memberId);
}
