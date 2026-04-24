import { redirect } from "next/navigation";

export default async function SecuritySettingsPage() {
  redirect("/profile/settings/chat-privacy");
}
