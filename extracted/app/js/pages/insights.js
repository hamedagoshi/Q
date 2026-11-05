import planned from './planned.js';

export default {
  ...planned,
  title: 'تحلیل',
  config: {
    faTitle: 'تحلیل عملکرد',
    enTitle: 'Performance analytics',
    faBody: 'نرخ برد، فاکتور سود، انتظار ریاضی و دراودان از معاملات واقعی محاسبه می‌شوند، نه از داده‌های ساختگی. این بخش پس از ورود دادهٔ معامله (فاز ۳) و روی همان داده، در فاز ۴ ساخته می‌شود.',
    enBody: 'Win rate, profit factor, expectancy and drawdown are computed from real trades, never from sample data. This section follows the trade foundation (Phase 3) and is built on that data in Phase 4.',
    phase: 'Phase 4',
  },
};
