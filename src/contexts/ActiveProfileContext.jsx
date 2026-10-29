import { useCallback, useEffect, useMemo, useState } from 'react';
import { getPatientProfiles } from '../api/patients';
import { ProfileContext } from './activeProfile';

function mapProfile(profile) {
  const isSelf = String(profile.relation).toUpperCase() === 'SELF';
  return {
    ...profile,
    label: isSelf ? 'Me' : profile.relation,
    relation: isSelf ? 'SELF' : profile.relation,
    color: isSelf ? 'teal' : /mother|father|spouse/i.test(profile.relation) ? 'violet' : /child/i.test(profile.relation) ? 'amber' : 'teal',
    initials: String(profile.name || ' ').trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
  };
}

export function ActiveProfileProvider({ children }) {
  const [profiles, setProfiles] = useState([]);
  const [activeProfileId, setActiveProfileId] = useState(() => window.localStorage.getItem('arogyanexus.activeProfile') || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refreshProfiles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const results = await getPatientProfiles();
      const mapped = results.map(mapProfile);
      setProfiles(mapped);
      const saved = window.localStorage.getItem('arogyanexus.activeProfile');
      const active = mapped.some((profile) => profile.id === saved) ? saved
        : mapped.find((profile) => profile.relation === 'SELF')?.id || mapped[0]?.id || '';
      setActiveProfileId(active);
      if (active) window.localStorage.setItem('arogyanexus.activeProfile', active);
      return mapped;
    } catch (failure) {
      setError(failure.message || 'Could not load patient profiles.');
      throw failure;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshProfiles().catch(() => {}); }, [refreshProfiles]);

  const activeProfile = profiles.find((profile) => profile.id === activeProfileId)
    || profiles.find((profile) => profile.relation === 'SELF') || profiles[0] || null;
  const setActiveProfile = useCallback((id) => {
    if (!profiles.some((profile) => profile.id === id)) return;
    setActiveProfileId(id);
    window.localStorage.setItem('arogyanexus.activeProfile', id);
  }, [profiles]);
  const value = useMemo(() => ({ profiles, activeProfile, setActiveProfile, refreshProfiles, loading, error }), [profiles, activeProfile, setActiveProfile, refreshProfiles, loading, error]);
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}
