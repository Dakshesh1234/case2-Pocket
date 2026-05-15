import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';

export default function JoinGroup() {
  const { code } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    api.post(`/groups/join/${code}`)
      .then(res => navigate(`/groups/${res.data.group.id}`))
      .catch(() => navigate('/'));
  }, [code, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
    </div>
  );
}
