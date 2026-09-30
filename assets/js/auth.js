import { auth, db, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, collection, doc, setDoc, serverTimestamp, signInWithPopup, googleProvider } from "./firebase.js";

export async function register({name,email,password,role="customer"}){
  const cred=await createUserWithEmailAndPassword(auth,email,password);
  await setDoc(doc(db,"users",cred.user.uid),{name,email,role,createdAt:serverTimestamp()});
  return cred.user;
}
export async function login(email,password){return (await signInWithEmailAndPassword(auth,email,password)).user}
export async function googleLogin(){return (await signInWithPopup(auth,googleProvider)).user}
export async function resetPassword(email){return sendPasswordResetEmail(auth,email)}
