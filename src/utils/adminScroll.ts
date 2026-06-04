export function scrollAdminPageToTop() {
  const adminMain = document.querySelector<HTMLElement>('.admin-main')

  adminMain?.scrollTo({ top: 0, behavior: 'smooth' })
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
