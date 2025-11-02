import { PromptTemplate } from "@langchain/core/prompts";

export const prompt_get_hashtags = (name: string, phoneNumber: string, email: string, summary: string, preExistingHashtags: string[]) => {
  return new PromptTemplate({
    template: `
  You are a helpful assistant that can help with tasks related to the user's contacts.
  You will be given a contact name, phone number, email, and summary.
  You will need to extract the hashtags from the contact. Feel free to use the pre-existing hashtags to help you. If needed change them e.g. atl -> atlanta
  Your final output will be the ALL hastags used for the user, combine old and new hastags u made to create the final list. Don't include the contacts actual name in the hashtags.

  Return descriptive hashtags (just the hashtags, comma-separated), all lowercase, based on the following contact:

  Pre-existing hashtags: ${preExistingHashtags.join(', ')}
  Contact name: ${name}
  Contact phone number: ${phoneNumber}
  Contact email: ${email}
  Contact summary: ${summary}

  Return only the hashtags, comma-separated, all lowercase.
  Example Output: #google, #pm, #product, #tech, #sf, #networking, #wfc
  `,
    inputVariables: ['preExistingHashtags', 'name', 'phoneNumber', 'email', 'summary'],
  });
};
