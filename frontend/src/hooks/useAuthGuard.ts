// hooks/useAuthGuard.ts
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { auth } from "@/lib/firebaseClient"
import { onAuthStateChanged } from "firebase/auth"

export function useAuthGuard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) router.push("/signin")
      else setLoading(false)
    })

    return () => unsubscribe()
  }, [router])

  return loading
}
