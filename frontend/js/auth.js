/*frontend/js/auth.js*/
import {
  auth,
  googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification
} from "./firebase.js";

/* ================= LOGIN ================= */
window.login = async function () {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    
    if (!userCred.user.emailVerified) {
      alert("Please verify your email before logging in.");
      return;
    }

    alert("Login successful");
    window.location.href = "chat.html";

  } catch (err) {
    alert(err.message);
  }
};

/* ================= SIGNUP ================= */
window.signup = async function () {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    const userCred = await createUserWithEmailAndPassword(auth, email, password);

    // Send verification mail
    await sendEmailVerification(userCred.user);

    alert("Account created. Verification email sent!");
    window.location.href = "index.html";

  } catch (err) {
    alert(err.message);
  }
};

/* ================= GOOGLE LOGIN ================= */
window.googleLogin = async function () {
  try {
    await signInWithPopup(auth, googleProvider);
    window.location.href = "chat.html";
  } catch (err) {
    alert(err.message);
  }
};

/* ================= RESET PASSWORD ================= */
window.resetPassword = async function () {
  const email = document.getElementById("email").value.trim();
  if (!email) {
    alert("Enter your email first.");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    alert("Password reset email sent.");
  } catch (err) {
    alert(err.message);
  }
};
