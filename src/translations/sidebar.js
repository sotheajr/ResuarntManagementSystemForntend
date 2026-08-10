/**
 * Sidebar navigation translations for English (en) and Khmer (kh).
 * All sidebar menu labels are defined here for bilingual support.
 */
const sidebarTranslations = {
  en: {
    // Admin menu items
    'Dashboard': 'Dashboard',
    'Users': 'Users',
    'List Users': 'List Users',
    'Create User': 'Create User',
    'Roles': 'Roles',
    'Categories': 'Categories',
    'Menu Items': 'Menu Items',
    'Product List': 'Product List',
    'Create Item': 'Create Item',
    'Tables': 'Tables',
    'Customers': 'Customers',
    'Reservations': 'Reservations',
    'Orders': 'Orders',
    'Active Orders': 'Active Orders',
    'Complete Orders': 'Complete Orders',
    'Order History': 'Order History',
    'Payments': 'Payments',
    'Process Payment': 'Process Payment',
    'Payment Success': 'Payment Success',
    'Reports': 'Reports',
    'Daily Sales': 'Daily Sales',
    'Weekly Sales': 'Weekly Sales',
    'Monthly Reports': 'Monthly Reports',
    'Yearly Sales': 'Yearly Sales',
    'Inventory': 'Inventory',
    'Suppliers': 'Suppliers',
    'Partners': 'Partners',
    'Attendance': 'Attendance',
    'Clock In': 'Clock In',
    'Clock Out': 'Clock Out',
    'Attendance History': 'Attendance History',
    'Payroll': 'Payroll',
    'Purchases': 'Purchases',
    'Recycle Bin': 'Recycle Bin',
    // Cashier/Waiter menu items
    'Menu': 'Menu',
    'Bills': 'Bills',
    // Role badges
    'Admin': 'Admin',
    'Waiter': 'Waiter',
    'Cashier': 'Cashier',
    'User': 'User',
    // Profile dropdown
    'My Profile': 'My Profile',
    'Logout': 'Logout',
    // Header
    'FastBites': 'FastBites',
    'Fast Food & Casual Dining': 'Fast Food & Casual Dining',
    'FastBites — Restaurant POS': 'FastBites — Restaurant POS',
    // Sidebar tooltips
    'Collapse sidebar': 'Collapse sidebar',
    'Expand sidebar': 'Expand sidebar',
    // Loading
    'Redirecting...': 'Redirecting...',
    'Loading...': 'Loading...',
  },
  kh: {
    // Admin menu items
    'Dashboard': 'ផ្ទាំងគ្រប់គ្រង',
    'Users': 'អ្នកប្រើប្រាស់',
    'List Users': 'បញ្ជីអ្នកប្រើប្រាស់',
    'Create User': 'បង្កើតអ្នកប្រើប្រាស់',
    'Roles': 'តួនាទី',
    'Categories': 'ប្រភេទ',
    'Menu Items': 'មុខម្ហូប',
    'Product List': 'បញ្ជីមុខម្ហូប',
    'Create Item': 'បង្កើតមុខម្ហូប',
    'Tables': 'តុ',
    'Customers': 'អតិថិជន',
    'Reservations': 'ការកក់',
    'Orders': 'ការបញ្ជាទិញ',
    'Active Orders': 'ការបញ្ជាទិញសកម្ម',
    'Complete Orders': 'ការបញ្ជាទិញបានបញ្ចប់',
    'Order History': 'ប្រវត្តិការបញ្ជាទិញ',
    'Payments': 'ការទូទាត់',
    'Process Payment': 'ដំណើរការទូទាត់',
    'Payment Success': 'ការទូទាត់ជោគជ័យ',
    'Reports': 'របាយការណ៍',
    'Daily Sales': 'ការលក់ប្រចាំថ្ងៃ',
    'Weekly Sales': 'ការលក់ប្រចាំសប្តាហ៍',
    'Monthly Reports': 'របាយការណ៍ប្រចាំខែ',
    'Yearly Sales': 'ការលក់ប្រចាំឆ្នាំ',
    'Inventory': 'ស្តុក',
    'Suppliers': 'អ្នកផ្គត់ផ្គង់',
    'Partners': 'ដៃគូ',
    'Attendance': 'វត្តមាន',
    'Clock In': 'ចូលធ្វើការ',
    'Clock Out': 'ចេញពីការងារ',
    'Attendance History': 'ប្រវត្តិវត្តមាន',
    'Payroll': 'ប្រាក់ខែ',
    'Purchases': 'ការទិញ',
    'Recycle Bin': 'ធុងសំរាម',
    // Cashier/Waiter menu items
    'Menu': 'ម៉ឺនុយ',
    'Bills': 'វិក្កយបត្រ',
    // Role badges
    'Admin': 'អ្នកគ្រប់គ្រង',
    'Waiter': 'អ្នកបម្រើ',
    'Cashier': 'អ្នកគិតលុយ',
    'User': 'អ្នកប្រើប្រាស់',
    // Profile dropdown
    'My Profile': 'ប្រវត្តិរូបខ្ញុំ',
    'Logout': 'ចាកចេញ',
    // Header
    'FastBites': 'FastBites',
    'Fast Food & Casual Dining': 'អាហាររហ័ស និងអាហារធម្មតា',
    'FastBites — Restaurant POS': 'FastBites — ប្រព័ន្ធ POS ភោជនីយដ្ឋាន',
    // Sidebar tooltips
    'Collapse sidebar': 'បង្រួមរបារចំហៀង',
    'Expand sidebar': 'ពង្រីករបារចំហៀង',
    // Loading
    'Redirecting...': 'កំពុងបញ្ជូនបន្ត...',
    'Loading...': 'កំពុងផ្ទុក...',
  },
};

/**
 * Translate a key based on the current language.
 * @param {string} key - The English key to translate
 * @param {string} lang - The language code ('en' or 'kh')
 * @returns {string} The translated string, or the key itself if not found
 */
export const t = (key, lang) => {
  if (!key) return '';
  const translations = sidebarTranslations[lang] || sidebarTranslations.en;
  return translations[key] || key;
};

export default sidebarTranslations;