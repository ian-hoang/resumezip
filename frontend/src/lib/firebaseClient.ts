// lib/firebaseClient.ts
import { initializeApp } from "firebase/app"
import { getAuth, GoogleAuthProvider, GithubAuthProvider, signInWithRedirect } from "firebase/auth"

const firebaseConfig = {
    apiKey: "AIzaSyASPtFrMu5P7kmk9CYyc2F692-nwSFx8e4",
    authDomain: "login.resumezip.io",
    projectId: "resumezip-io",
    storageBucket: "resumezip-io.firebasestorage.app",
    messagingSenderId: "303685862121",
    appId: "1:303685862121:web:fcbb54599a9d7610252678",
    measurementId: "G-468LWPVSJ9"
}

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)

export { auth, GoogleAuthProvider, GithubAuthProvider, signInWithRedirect }
