import { useState, useEffect } from 'react';
import menuApi from '../api/menuApi';

const useFetchMenu = () => {
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMenu = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await menuApi.getAll();
        setMenu(response.data?.data || response.data || []);
      } catch (err) {
        setError(err?.data?.message || err?.message || 'Failed to fetch menu items.');
      } finally {
        setLoading(false);
      }
    };

    fetchMenu();
  }, []);

  return { menu, loading, error };
};

export default useFetchMenu;
