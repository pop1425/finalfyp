// src/hooks/useContacts.ts
import { useState, useEffect } from 'react';
import * as Contacts from 'expo-contacts';

export function useContacts() {
  const [hasContactsPermission, setHasContactsPermission] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Contacts.requestPermissionsAsync();
        setHasContactsPermission(status === 'granted');
      } catch (e) {
        console.error('Error requesting contacts permission:', e);
      }
    })();
  }, []);

  /**
   * Search for a contact by name in the phone book.
   * @param name - The name to look for (case-insensitive).
   * @returns The contact details if found, or null.
   */
  const findContactByName = async (name: string): Promise<{ name: string; number: string | null } | null> => {
    if (!name || typeof name !== 'string') {
      console.warn('[useContacts] findContactByName called with invalid name:', name);
      return null;
    }
    let permissionGranted = hasContactsPermission;
    if (!permissionGranted) {
      try {
        const { status } = await Contacts.requestPermissionsAsync();
        permissionGranted = status === 'granted';
        setHasContactsPermission(permissionGranted);
        if (!permissionGranted) {
          console.warn('[useContacts] Permission not granted for contacts.');
          return null;
        }
      } catch (e) {
        console.error('[useContacts] Error requesting contacts permission in function:', e);
        return null;
      }
    }

    try {
      // Retrieve contacts with names and phone numbers
      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.FirstName,
          Contacts.Fields.LastName,
          Contacts.Fields.Name,
          Contacts.Fields.PhoneNumbers,
        ],
        pageSize: 1000,
      });

      if (!data || data.length === 0) {
        console.log('[useContacts] No contacts found in the phone book.');
        return null;
      }

      const query = name.toLowerCase().trim();
      console.log(`[useContacts] Searching for contact matching name: "${name}" (query: "${query}")`);
      console.log(`[useContacts] Total contacts fetched from device: ${data.length}`);

      // Normalize a string for comparison (remove punctuation, accents, extra spaces)
      const normalize = (str: string) => {
        return str
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "") // remove accents
          .replace(/[^a-z0-9\s]/g, "") // remove special characters
          .replace(/\s+/g, " ")
          .trim();
      };

      const normalizedQuery = normalize(query);
      const queryWords = normalizedQuery.split(' ').filter(w => w.length > 0);

      if (queryWords.length === 0) return null;

      // We will rank contacts based on matching quality:
      // Score 4: Exact match (normalized full name or display name equals normalized query)
      // Score 3: Start match (normalized contact name starts with query, or query starts with contact name)
      // Score 2: Bidirectional substring match (normalized contact name contains query, or query contains contact name)
      // Score 1: Token match (shares at least one significant word/token)
      // Score 0: No match

      const scoredContacts = data.map(contact => {
        const contactName = contact.name || '';
        const firstName = contact.firstName || '';
        const lastName = contact.lastName || '';
        
        // Build clean names
        const cleanName = normalize(contactName);
        const cleanFirst = normalize(firstName);
        const cleanLast = normalize(lastName);
        const cleanCombined = normalize(`${firstName} ${lastName}`);

        let score = 0;

        // Check if any of the clean name variants match the query
        const namesToCheck = [cleanName, cleanFirst, cleanLast, cleanCombined].filter(Boolean);

        // 1. Exact Match (Score 4)
        if (namesToCheck.some(n => n === normalizedQuery)) {
          score = 4;
        }
        // 2. Start Match (Score 3)
        else if (namesToCheck.some(n => n.startsWith(normalizedQuery) || normalizedQuery.startsWith(n))) {
          score = 3;
        }
        // 3. Bidirectional Substring Match (Score 2)
        else if (namesToCheck.some(n => n.includes(normalizedQuery) || normalizedQuery.includes(n))) {
          score = 2;
        }
        // 4. Word/Token Match (Score 1)
        else {
          const contactWords = [
            ...cleanName.split(' '),
            ...cleanFirst.split(' '),
            ...cleanLast.split(' ')
          ].filter(Boolean);
          
          // Check if any word in the contact name matches a word in the query (excluding common short words)
          const hasSharedToken = queryWords.some(qw => 
            qw.length >= 3 && contactWords.some(cw => cw === qw)
          );
          
          if (hasSharedToken) {
            score = 1;
          }
        }

        return { contact, score, cleanName };
      });

      // Filter out scores of 0, then sort by score descending. If scores match, prioritize contacts with phone numbers.
      const matchedItems = scoredContacts
        .filter(item => item.score > 0)
        .sort((a, b) => {
          if (b.score !== a.score) {
            return b.score - a.score;
          }
          const aHasPhone = a.contact.phoneNumbers && a.contact.phoneNumbers.length > 0 ? 1 : 0;
          const bHasPhone = b.contact.phoneNumbers && b.contact.phoneNumbers.length > 0 ? 1 : 0;
          return bHasPhone - aHasPhone;
        });

      console.log(`[useContacts] Found ${matchedItems.length} matching contact(s).`);
      if (matchedItems.length > 0) {
        matchedItems.forEach((m, idx) => {
          console.log(`  Match #${idx + 1}: "${m.contact.name}" (Score: ${m.score}, Phone: ${m.contact.phoneNumbers?.[0]?.number || 'None'})`);
        });
      } else {
        // Log the first 5 contacts in the address book for debugging
        console.log('[useContacts] No matches found. Sample of contacts in phonebook:');
        data.slice(0, 5).forEach((c, idx) => {
          console.log(`  Sample #${idx + 1}: "${c.name}" (Phone: ${c.phoneNumbers?.[0]?.number || 'None'}, First: "${c.firstName}", Last: "${c.lastName}")`);
        });
      }

      if (matchedItems.length > 0) {
        const match = matchedItems[0].contact;
        
        // Extract phone number from phoneNumbers list (trying both number and digits fields)
        let number: string | null = null;
        if (match.phoneNumbers && match.phoneNumbers.length > 0) {
          // Find first non-empty phone number
          for (const phone of match.phoneNumbers) {
            if (phone) {
              const rawPhone = phone.number || phone.digits;
              if (rawPhone) {
                // Clean the number: keep only digits and leading '+'
                const cleaned = rawPhone.replace(/(?!^\+)\D/g, '');
                if (cleaned) {
                  number = cleaned;
                  break;
                }
              }
            }
          }
        }
        
        return {
          name: match.name || `${match.firstName || ''} ${match.lastName || ''}`.trim(),
          number: number
        };
      }
      return null;
    } catch (e) {
      console.error('Error querying contacts:', e);
      return null;
    }
  };

  return {
    hasContactsPermission,
    findContactByName
  };
}
