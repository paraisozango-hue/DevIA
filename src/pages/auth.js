import { icon } from '../components/ui.js';

export function renderAuthPage(mode = 'login') {
  const signup = mode === 'signup';
  const title = signup ? 'Crie seu espaço.' : 'Entre na sua conta.';
  const eyebrow = signup ? 'COMECE AGORA' : 'BEM-VINDO DE VOLTA';
  const description = signup
    ? 'Crie sua conta e tenha um workspace pronto para construir software com IA.'
    : 'Continue de onde parou e acesse seus projetos, conversas e integrações.';

  return '<main class="auth-page">' +
    '<div class="auth-page__glow auth-page__glow--one"></div><div class="auth-page__glow auth-page__glow--two"></div>' +
    '<section class="auth-card">' +
      '<a class="auth-brand" href="/" data-link><span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M6 8.5h8.5c2 0 3.5 1.5 3.5 3.5v8.5c0 2 1.5 3.5 3.5 3.5H26" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M7 23.5h4.5c2 0 3.5-1.5 3.5-3.5v-8.5C15 9.5 16.5 8 18.5 8H25" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="7" cy="8.5" r="2" fill="currentColor"/><circle cx="25" cy="23.5" r="2" fill="currentColor"/><circle cx="25" cy="8" r="2" fill="currentColor"/><circle cx="7" cy="23.5" r="2" fill="currentColor"/></svg></span><strong>DevIA<span>.</span></strong></a>' +
      '<div class="auth-card__intro"><span class="eyebrow">' + eyebrow + '</span><h1>' + title + '</h1><p>' + description + '</p></div>' +
      '<form class="auth-form" data-form="auth" data-mode="' + (signup ? 'signup' : 'login') + '">' +
        (signup ? '<label for="auth-name">Seu nome</label><input id="auth-name" name="name" type="text" autocomplete="name" placeholder="Ex.: João Manuel" maxlength="80" required />' : '') +
        '<label for="auth-email">E-mail</label><input id="auth-email" name="email" type="email" autocomplete="email" placeholder="voce@exemplo.com" required />' +
        '<label for="auth-password">Senha</label><input id="auth-password" name="password" type="password" autocomplete="' + (signup ? 'new-password' : 'current-password') + '" placeholder="Mínimo de 6 caracteres" minlength="6" required />' +
        (signup ? '<label for="auth-password-confirm">Confirmar senha</label><input id="auth-password-confirm" name="passwordConfirm" type="password" autocomplete="new-password" placeholder="Digite a senha novamente" minlength="6" required />' : '') +
        '<button class="button button--primary auth-form__submit" type="submit">' + (signup ? 'Criar minha conta' : 'Entrar') + ' ' + icon('arrow', 15) + '</button>' +
      '</form>' +
      '<div class="auth-card__switch">' + (signup ? 'Já tem uma conta?' : 'Ainda não tem uma conta?') + ' <a href="/' + (signup ? 'login' : 'signup') + '" data-link>' + (signup ? 'Entrar' : 'Criar conta') + '</a></div>' +
      '<div class="auth-card__footer">' + icon('shield', 13) + ' Seus dados ficam no Supabase da plataforma e são protegidos por autenticação e RLS.</div>' +
    '</section></main>';
}
