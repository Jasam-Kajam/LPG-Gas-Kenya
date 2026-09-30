import {
  auth,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail
} from "./firebase.js";

/**
 * Email + password login
 */
export async function login(email, password) {
  email = email.trim();

  if (!email || !password) {
    throw new Error("Please enter your email and password.");
  }

  try {
    const result = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    return result.user;
  } catch (error) {
    console.error("Login error:", error);

    switch (error.code) {
      case "auth/invalid-credential":
        throw new Error("Incorrect email or password.");

      case "auth/user-not-found":
        throw new Error("No account exists with this email.");

      case "auth/wrong-password":
        throw new Error("Incorrect password.");

      case "auth/invalid-email":
        throw new Error("Please enter a valid email address.");

      case "auth/user-disabled":
        throw new Error("This account has been disabled.");

      case "auth/too-many-requests":
        throw new Error(
          "Too many unsuccessful attempts. Please try again later."
        );

      case "auth/network-request-failed":
        throw new Error(
          "Network error. Check your internet connection and try again."
        );

      case "auth/operation-not-allowed":
        throw new Error(
          "Email/password sign-in is not enabled in Firebase Authentication."
        );

      case "auth/unauthorized-domain":
        throw new Error(
          "This website domain is not authorized in Firebase Authentication."
        );

      default:
        throw new Error(error.message || "Unable to sign in.");
    }
  }
}

/**
 * Google login
 */
export async function googleLogin() {
  try {
    const provider = new GoogleAuthProvider();

    const result = await signInWithPopup(auth, provider);

    return result.user;
  } catch (error) {
    console.error("Google login error:", error);

    switch (error.code) {
      case "auth/popup-closed-by-user":
        throw new Error("Google sign-in was cancelled.");

      case "auth/popup-blocked":
        throw new Error(
          "The browser blocked the Google sign-in window."
        );

      case "auth/unauthorized-domain":
        throw new Error(
          "This website domain is not authorized in Firebase Authentication."
        );

      case "auth/account-exists-with-different-credential":
        throw new Error(
          "An account already exists with this email using another sign-in method."
        );

      case "auth/network-request-failed":
        throw new Error(
          "Network error. Check your internet connection and try again."
        );

      default:
        throw new Error(
          error.message || "Google sign-in failed."
        );
    }
  }
}

/**
 * Password reset
 */
export async function resetPassword(email) {
  email = email.trim();

  if (!email) {
    throw new Error("Enter your email address first.");
  }

  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    console.error("Password reset error:", error);

    switch (error.code) {
      case "auth/invalid-email":
        throw new Error("Please enter a valid email address.");

      case "auth/user-not-found":
        throw new Error("No account exists with this email.");

      case "auth/network-request-failed":
        throw new Error(
          "Network error. Check your internet connection and try again."
        );

      default:
        throw new Error(
          error.message || "Unable to send password reset email."
        );
    }
  }
}