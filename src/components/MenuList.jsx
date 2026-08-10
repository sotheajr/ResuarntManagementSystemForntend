import React from 'react';
import useFetchMenu from '../hooks/useFetchMenu';

const MenuList = () => {
  const { menu, loading, error } = useFetchMenu();

  if (loading) {
    return <div className="text-center py-10">Loading menu...</div>;
  }

  if (error) {
    return <div className="text-center py-10 text-red-600">{error}</div>;
  }

  if (!menu.length) {
    return <div className="text-center py-10">No menu items found.</div>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {menu.map((item) => (
        <div key={item.id || item.menu_id} className="rounded-xl border border-slate-200 p-4 shadow-sm">
          <h3 className="text-lg font-semibold">{item.name || item.menu_name}</h3>
          <p className="text-sm text-slate-600">{item.description || item.details || 'No description available.'}</p>
          <div className="mt-3 flex items-center justify-between text-sm text-slate-700">
            <span>{item.category_name || item.category || 'Uncategorized'}</span>
            <span className="font-semibold">{item.price ? `USD ${item.price}` : 'Price TBD'}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MenuList;
