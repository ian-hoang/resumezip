import { redirect } from "next/navigation"

// Contact is part of About now. Old links, and messages already sent with
// this address, still land on its form.
export default function ContactPage() {
  redirect("/about#contact")
}
