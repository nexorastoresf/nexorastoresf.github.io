/* NEXORA STORE SF | Acceso web para navegadores móviles y desktop.
 * NEXORA NUEVO usa Firebase nexora-store-sf y no migra usuarios ni saldos
 * del proyecto anterior. Apple requiere configuración en Apple Developer
 * y habilitación en Firebase Authentication antes de activar el botón. */
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  OAuthProvider,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { auth, googleProvider } from "./firebase.js?v=20261122-auth-key-2";

auth.useDeviceLanguage();
const $ = id => document.getElementById(id);
const isLogin = document.body.dataset.nexoraPage === "login";
const message = $("message");
const loginForm = $("loginForm");
const loginBtn = $("loginButton");
const registerBtn = $("registerBtn");
const googleBtn = $("googleButton") || $("googleBtn");
const appleBtn = $("appleButton") || $("appleBtn");
const forgotBtn = $("forgotPassword");
const remember = $("rememberMe");
const email = $("email");
const password = $("password");
const appleProvider = new OAuthProvider("apple.com");
appleProvider.addScope("email");
appleProvider.addScope("name");

const buttons = [loginBtn, registerBtn, googleBtn, appleBtn].filter(Boolean);
// No reactivar métodos que se anunciaron como "próximamente".
const permanentlyDisabled = new Set(buttons.filter(button => button.disabled));
let busy = false;
function showMessage(text, type = "error") {
  if (!message) return;
  message.textContent = text;
  message.dataset.type = type;
  message.className = "message " + type;
  message.style.display = text ? "block" : "none";
  message.setAttribute("role", type === "error" ? "alert" : "status");
}
function setBusy(state) {
  busy = state;
  for (const button of buttons) button.disabled = state || permanentlyDisabled.has(button);
  if (loginBtn) loginBtn.textContent = state ? "Ingresando…" : "Iniciar sesión";
  if (registerBtn) registerBtn.textContent = state ? "Creando cuenta…" : "Crear cuenta";
  if (googleBtn) googleBtn.textContent = state ? "Conectando…" : "Continuar con Google";
  if (appleBtn) appleBtn.textContent = permanentlyDisabled.has(appleBtn)
    ? "Apple ID (próximamente)"
    : (state ? "Conectando…" : "Continuar con Apple");
}
function safeErrorCode(error) {
  const code = typeof error?.code === "string" ? error.code : "";
  return /^auth\/[a-z0-9-]{1,80}$/.test(code) ? code : "";
}
function diagnosticDetail(error) {
  const code = safeErrorCode(error);
  if (code) return " Código técnico: " + code + ".";
  // Los errores sin código también deben poder diagnosticarse, sin publicar
  // enlaces ni correos electrónicos en la interfaz de la tienda.
  const detail = String(error?.message || "")
    .replace(/https?:\/\/\S+/gi, "[enlace]")
    .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, "[correo]")
    .replace(/\s+/g, " ").slice(0, 150);
  return detail ? " Detalle técnico: " + detail : " Error de autenticación sin código.";
}
function errorMessage(error, providerName = "") {
  if (/api-key-not-valid|invalid-api-key|API_KEY_INVALID/i.test(String(error?.message || "") + " " + String(error?.code || ""))) {
    return "Firebase está rechazando la clave API. Revisa la clave y sus restricciones en Google Cloud Console (proyecto nexora-store-sf).";
  }
  switch (error?.code) {
    case "auth/invalid-email": return "Ingresa un correo electrónico válido.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found": return "Correo o contraseña incorrectos.";
    case "auth/weak-password": return "La contraseña es demasiado débil. Prueba una más segura.";
    case "auth/email-already-in-use": return "Ya existe una cuenta con ese correo. Inicia sesión.";
    case "auth/user-disabled": return "Esta cuenta está deshabilitada.";
    case "auth/network-request-failed": return "No hay conexión con el servidor. Verifica tu internet e inténtalo otra vez.";
    case "auth/too-many-requests": return "Demasiados intentos. Inténtalo más tarde.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request": return "Se cerró o canceló el inicio de sesión.";
    case "auth/popup-blocked": return "El navegador bloqueó la ventana de acceso. Permite ventanas emergentes y vuelve a intentarlo.";
    case "auth/unauthorized-domain": return "El dominio de NEXORA debe autorizarse en Firebase Authentication.";
    case "auth/account-exists-with-different-credential":
      return "Este correo ya está asociado a otro método. Entra con el método que utilizaste primero para conservar tu cuenta y saldo.";
    case "auth/operation-not-allowed":
      return providerName ? "El acceso con " + providerName + " aún no está habilitado por NEXORA. Usa tu correo o Google mientras tanto." : "Este método de acceso todavía no está habilitado.";
    case "auth/operation-not-supported-in-this-environment":
    case "auth/web-storage-unsupported":
      return "Este navegador no permite completar el acceso. Abre NEXORA directamente en Safari, Chrome, Edge o Firefox.";
    case "auth/invalid-oauth-client-id":
    case "auth/invalid-oauth-provider": return "La configuración del proveedor de acceso debe revisarse.";
    default:
      return providerName
        ? "No se pudo acceder con " + providerName + ". Revisa la configuración del proveedor en Firebase o prueba otro navegador."
        : "No se pudo completar el acceso. Vuelve a intentarlo.";
  }
}
function goToProfile() {
  window.location.assign("perfil.html");
}
async function loginWithEmail(event) {
  event.preventDefault();
  if (busy) return;
  showMessage("");
  setBusy(true);
  try {
    await setPersistence(auth, remember?.checked === false ? browserSessionPersistence : browserLocalPersistence);
    await signInWithEmailAndPassword(auth, email.value.trim(), password.value);
    goToProfile();
  } catch (error) {
    console.error("NEXORA login", error.code || error);
    showMessage(errorMessage(error));
  } finally {
    setBusy(false);
  }
}
async function registerWithEmail() {
  if (busy) return;
  showMessage("");
  const name = $("name")?.value.trim() || "";
  const mail = email?.value.trim() || "";
  const pass = password?.value || "";
  const confirm = $("confirmPassword")?.value || "";
  if (!name) { showMessage("Escribe tu nombre."); $("name")?.focus(); return; }
  if (!mail) { showMessage("Escribe tu correo electrónico."); email?.focus(); return; }
  if (pass.length < 6) { showMessage("La contraseña debe tener al menos 6 caracteres."); password?.focus(); return; }
  if (pass !== confirm) { showMessage("Las contraseñas no coinciden."); $("confirmPassword")?.focus(); return; }
  setBusy(true);
  try {
    await setPersistence(auth, browserLocalPersistence);
    const credential = await createUserWithEmailAndPassword(auth, mail, pass);
    try { await updateProfile(credential.user, { displayName: name }); }
    catch (e) { console.warn("No se pudo guardar el nombre", e.code || e); }
    goToProfile();
  } catch (error) {
    console.error("NEXORA registration", error.code || error);
    showMessage(errorMessage(error));
  } finally { setBusy(false); }
}
async function oauthSignIn(provider, providerName) {
  if (busy) return;
  showMessage("");
  setBusy(true);
  try {
    // Iniciar el popup directamente desde el clic para evitar bloqueos en Safari.
    await signInWithPopup(auth, provider);
    goToProfile();
  } catch (error) {
    console.error("NEXORA OAuth " + providerName, error);
    showMessage(errorMessage(error, providerName) + diagnosticDetail(error));
  } finally {
    setBusy(false);
  }
}

loginForm?.addEventListener("submit", loginWithEmail);
registerBtn?.addEventListener("click", registerWithEmail);
googleBtn?.addEventListener("click", () => oauthSignIn(googleProvider, "Google"));
appleBtn?.addEventListener("click", () => oauthSignIn(appleProvider, "Apple"));
remember?.addEventListener("change", () => {
  setPersistence(auth, remember.checked ? browserLocalPersistence : browserSessionPersistence)
    .catch(() => showMessage("No se pudo actualizar la preferencia de sesión."));
});
forgotBtn?.addEventListener("click", async event => {
  event.preventDefault();
  if (busy) return;
  const mail = email?.value.trim() || "";
  if (!mail) { showMessage("Escribe primero tu correo electrónico."); email?.focus(); return; }
  try {
    await sendPasswordResetEmail(auth, mail);
    showMessage("Si existe una cuenta con ese correo, recibirás instrucciones para recuperar el acceso.", "success");
  } catch (error) {
    console.error("NEXORA password reset", error.code || error);
    showMessage(errorMessage(error));
  }
});
