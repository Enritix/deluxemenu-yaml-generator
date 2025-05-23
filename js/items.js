const ITEMS_API_URL = "https://minecraft-api.vercel.app/api/items";

export async function loadItems() {
  const res = await fetch(ITEMS_API_URL);
    const data = await res.json();
    return data.filter(item => item.image && item.namespacedId);
}
