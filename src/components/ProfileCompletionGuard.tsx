import { useQuery } from '@tanstack/react-query';
import { getProfile } from '@/services/profileService';
import { useLocation, Navigate } from 'react-router-dom';
import { ReactNode } from 'react';

interface ProfileCompletionGuardProps {
  children: ReactNode;
}

export const ProfileCompletionGuard = ({ children }: ProfileCompletionGuardProps) => {
  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
  });

  const location = useLocation();

  if (isLoading) {
    // You might want to show a global loading spinner here
    return <div className="w-full h-screen flex items-center justify-center">Chargement du profil...</div>;
  }

  if (isError) {
    // Handle error case, maybe redirect to an error page or show a message
    return <div>Erreur lors du chargement du profil.</div>;
  }

  const isProfileComplete = profile?.first_name && profile.first_name.trim() !== '' &&
    profile?.last_name && profile.last_name.trim() !== '' &&
    // post_nom, country, city, address sont maintenant optionnels
    profile?.phone && profile.phone.trim() !== '' &&
    profile?.birth_date;

  // If profile is not complete and user is not already on the profile page or auth page
  if (!isProfileComplete && location.pathname !== '/profile' && location.pathname !== '/auth') {
    return <Navigate to="/profile" replace />;
  }

  // If profile is complete or user is on the allowed pages, render the children
  return <>{children}</>;
};
