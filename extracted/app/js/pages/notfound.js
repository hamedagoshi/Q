export default {
  title: 'یافت نشد',
  html({ path }) {
    return `
    <div class="state" style="padding-block:64px">
      <div class="state__icon">?</div>
      <div class="state__title">این صفحه وجود ندارد</div>
      <div class="state__body">مسیر <code class="num">${path}</code> در MONAD تعریف نشده است.</div>
      <a class="btn btn--primary btn--sm state__action" href="/" data-link>بازگشت به امروز</a>
    </div>`;
  },
};
