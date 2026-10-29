import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getCurrentUser } from '../../api/auth.js';

export default function ProtectedRoute({ roles, children }) {
  const [user, setUser] = useState(null);
  const [checked, setChecked] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let active = true;
    getCurrentUser().then((currentUser) => {
      if (!active) return;
      setUser(currentUser);
      setChecked(true);
    });
    return () => { active = false; };
  }, []);

  if (!checked) return <div className="patient-route-loading" role="status">Checking session…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (roles && !roles.includes(user.role.toUpperCase())) return <Navigate to="/login" replace />;
  return typeof children === 'function' ? children(user) : children;
}
