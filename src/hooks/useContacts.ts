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
      // 1. Normalize a string for comparison (remove punctuation, accents, Unicode non-letters, extra spaces)
      const normalize = (text: string) => {
        if (!text) return "";
        return text
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "") // remove accents
          .replace(/[^\p{L}\p{N}\s]/gu, "") // keep Unicode letters, numbers, and spaces
          .replace(/\s+/g, " ")
          .trim();
      };

      const normalizedQuery = normalize(name);
      
      console.log('[useContacts] Query Input:', {
        original: name,
        normalized: normalizedQuery
      });

      // 2. Retrieve contacts (Remove pageSize to avoid inconsistent pagination behavior on some OS platforms)
      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.FirstName,
          Contacts.Fields.LastName,
          Contacts.Fields.Name,
          Contacts.Fields.PhoneNumbers,
        ],
      });

      console.log('[useContacts] Raw Contacts Response Data Length:', data ? data.length : 0);

      if (!data || data.length === 0) {
        console.log('[useContacts] No contacts found in the phone book.');
        return null;
      }

      console.log(`[useContacts] Found ${data.length} contacts`);

      // Log first 10 sample contacts to inspect raw device structure
      console.log('[useContacts] Sample of first 10 contacts in phonebook:');
      data.slice(0, 10).forEach((contact, index) => {
        console.log(`  Sample #${index + 1}:`, {
          id: contact.id,
          name: contact.name,
          firstName: contact.firstName,
          lastName: contact.lastName,
          phoneNumbers: contact.phoneNumbers,
        });
      });

      const queryWords = normalizedQuery.split(' ').filter(w => w.length > 0);
      if (queryWords.length === 0) return null;

      // 3. Rank contacts based on matching quality
      // Score 4: Exact match (normalized name equals normalized query)
      // Score 3: Word-Prefix Match (all query words match starting of some contact words, or vice versa)
      // Score 2: Word-Substring Match (all query words match substring of some contact words, or vice versa)
      // Score 1: Token match (shares at least one significant word/token of length >= 3)
      // Score 0: No match
      const scoredContacts = data.map(contact => {
        // Build clean name. Many Android devices only populate contact.name, so check that primarily.
        const fallbackName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
        const displayName = contact.name || fallbackName;
        const cleanName = normalize(displayName);

        const contactWords = cleanName.split(' ').filter(w => w.length > 0);

        let score = 0;

        // Exact Match (Score 4)
        if (cleanName === normalizedQuery) {
          score = 4;
        }
        // Word-Prefix Match - Bidirectional (Score 3)
        else if (
          (queryWords.length > 0 && queryWords.every(qw => contactWords.some(cw => cw.startsWith(qw)))) ||
          (contactWords.length > 0 && contactWords.every(cw => queryWords.some(qw => qw.startsWith(cw))))
        ) {
          score = 3;
        }
        // Word-Substring Match - Bidirectional (Score 2)
        else if (
          (queryWords.length > 0 && queryWords.every(qw => contactWords.some(cw => cw.includes(qw)))) ||
          (contactWords.length > 0 && contactWords.every(cw => queryWords.some(qw => qw.includes(cw))))
        ) {
          score = 2;
        }
        // Word/Token Match (Score 1)
        else {
          const hasSharedToken = queryWords.some(qw => 
            qw.length >= 3 && contactWords.some(cw => cw.startsWith(qw) || cw.includes(qw))
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

      console.log(`[useContacts] Matches found: ${matchedItems.length} for search "${normalizedQuery}"`);
      if (matchedItems.length > 0) {
        matchedItems.forEach((m, idx) => {
          console.log(`  Match #${idx + 1}: "${m.contact.name}" (Score: ${m.score}, Phone: ${m.contact.phoneNumbers?.[0]?.number || 'None'})`);
        });
      }

      if (matchedItems.length > 0) {
        const match = matchedItems[0].contact;
        console.log('[useContacts] Selected Contact:', match);
        console.log('[useContacts] Selected Contact Phone Numbers:', match.phoneNumbers);
        
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
