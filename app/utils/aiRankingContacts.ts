import { Contact } from '../types/contact';

/**
 * AI-based contact ranking algorithm (mock implementation using alphabetical ordering)
 * In the future, this will use AI to rank contacts based on relevance to the search query
 * 
 * @param contacts - Array of contacts to rank
 * @param searchQuery - The search query to rank against
 * @returns Ranked array of contacts (max 20)
 */
export function aiRankingContacts(contacts: Contact[], searchQuery: string): Contact[] {
  if (!searchQuery.trim()) {
    // If no search query, return all contacts in alphabetical order (max 20)
    return [...contacts]
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 20);
  }

  // Filter contacts that match the search query (name, phone, or email)
  const filteredContacts = contacts.filter(contact => {
    const query = searchQuery.toLowerCase();
    return (
      contact.name.toLowerCase().includes(query) ||
      contact.phoneNumber.toLowerCase().includes(query) ||
      contact.email?.toLowerCase().includes(query)
    );
  });

  // Mock AI ranking: Sort alphabetically for now
  // TODO: Replace with actual AI ranking algorithm
  const rankedContacts = filteredContacts.sort((a, b) => 
    a.name.localeCompare(b.name)
  );

  // Return max 20 contacts
  return rankedContacts.slice(0, 20);
}


