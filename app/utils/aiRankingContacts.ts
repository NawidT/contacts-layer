import { Contact } from '../types/contact';

/**
 * AI-based contact ranking algorithm (mock implementation using alphabetical ordering)
 * In the future, this will use AI to rank contacts based on relevance to the search query
 * 
 * @param contacts - Array of contacts to rank
 * @param searchQuery - The search query to rank against
 * @returns Ranked array of contacts
 */
export function aiRankingContacts(contacts: Contact[], searchQuery: string): Contact[] {
  if (!searchQuery.trim()) {
    // If no search query, return all contacts in alphabetical order
    return [...contacts]
      .sort((a, b) => a.name.localeCompare(b.name))
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
  return rankedContacts;
}

/**
 * Extract hashtags from contact using OpenAI API
 * Works in React Native by using direct fetch calls instead of LangChain
 * 
 * @param contact - Contact to extract hashtags from
 * @returns Contact with hashtags populated
 */
export async function getInitialHashtags(contact: Contact): Promise<Contact> {
  // Return cached hashtags if already processed
  if (contact.hashtags && contact.hashtags.length > 0) {
    return contact;
  }

  // Check if API key is available
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'your_openai_api_key_here') {
    console.log('No OpenAI API key found, using fallback hashtag extraction');
    contact.hashtags = extractSimpleHashtags(contact);
    return contact;
  }

  try {
    const nameParts = contact.name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const prompt = `Given a contact name, extract relevant hashtags, focusing on:
- Company names (e.g., #google, #meta, #airbnb)
- Job roles (e.g., #engineer, #pm, #designer)
- Places or events (e.g., #conference, #hackathon, #ycombinator)
- Professional or personal context (e.g., #friend, #startup, #linkedin)
- Where they're from based off area code in their phone number e.g. 404 is #atlanta

Return 2-6 descriptive hashtags (just the hashtags, comma-separated), all lowercase, based on the following contact:

Contact name: ${firstName} ${lastName}
Contact phone number: ${contact.phoneNumber || ''}
Contact email: ${contact.email || ''}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const result = data.choices[0]?.message?.content || '';
    
    // Parse comma-separated hashtags
    contact.hashtags = result
      .split(',')
      .map((tag: string) => tag.trim())
      .filter((tag: string) => tag.length > 0);

    console.log(`Hashtags for ${contact.name}:`, contact.hashtags);
    return contact;
  } catch (error) {
    console.error('Error extracting hashtags with AI:', error);
    // Fallback to simple extraction
    contact.hashtags = extractSimpleHashtags(contact);
    return contact;
  }
}

/**
 * Fallback function to extract simple hashtags without AI
 * Uses pattern matching for common companies, roles, and contexts
 */
function extractSimpleHashtags(contact: Contact): string[] {
  const hashtags: string[] = [];
  const nameLower = contact.name.toLowerCase();
  
  // Common companies
  const companies = ['google', 'meta', 'facebook', 'apple', 'amazon', 'microsoft', 'netflix', 'tesla', 'stripe', 'airbnb', 'uber', 'aws', 'yc'];
  companies.forEach(company => {
    if (nameLower.includes(company)) {
      hashtags.push(`#${company}`);
    }
  });
  
  // Common roles
  const roles = ['engineer', 'eng', 'pm', 'designer', 'recruiter', 'founder', 'ceo', 'cto', 'marketing', 'sales'];
  roles.forEach(role => {
    if (nameLower.includes(role)) {
      hashtags.push(`#${role === 'eng' ? 'engineer' : role}`);
    }
  });
  
  // Common contexts
  if (nameLower.includes('friend')) hashtags.push('#friend');
  if (nameLower.includes('conference')) hashtags.push('#conference');
  if (nameLower.includes('hackathon')) hashtags.push('#hackathon');
  if (nameLower.includes('linkedin')) hashtags.push('#linkedin');
  if (nameLower.includes('startup')) hashtags.push('#startup');
  
  // Area code mapping (if no other hashtags found)
  if (hashtags.length === 0 && contact.phoneNumber) {
    const areaCode = contact.phoneNumber.replace(/\D/g, '').slice(0, 3);
    const areaCodeMap: { [key: string]: string } = {
      '404': 'atlanta',
      '212': 'nyc',
      '415': 'sf',
      '650': 'bayarea',
      '510': 'bayarea',
      '617': 'boston',
      '310': 'la',
      '206': 'seattle',
    };
    
    if (areaCodeMap[areaCode]) {
      hashtags.push(`#${areaCodeMap[areaCode]}`);
    }
  }
  
  return hashtags.length > 0 ? hashtags : ['#contact'];
}


