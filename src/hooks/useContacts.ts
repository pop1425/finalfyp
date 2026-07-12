// src/hooks/useContacts.ts
import { useState } from 'react';
import { Contact, ContactField } from 'expo-contacts';
import { requestPermissionsAsync } from 'expo-contacts/legacy';

export function useContacts() {
  const [hasContactsPermission, setHasContactsPermission] = useState<boolean>(false);

  const findContactByName = async (name: string): Promise<{ name: string; number: string | null } | null> => {
    try {
      if (!hasContactsPermission) {
        const { status } = await requestPermissionsAsync();
        if (status !== 'granted') {
          setHasContactsPermission(false);
          return null;
        }
        setHasContactsPermission(true);
      }

      const data = await Contact.getAllDetails(
        [ContactField.GIVEN_NAME, ContactField.FAMILY_NAME, ContactField.FULL_NAME, ContactField.PHONES],
        { name: name, limit: 50 }
      );

      if (!data || data.length === 0) return null;

      const query = name.toLowerCase().trim();

      // Try to find exact matches first
      let matches = data.filter(contact => {
        const fullName = [contact.givenName, contact.familyName, contact.fullName]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .trim();
        const firstName = (contact.givenName || '').toLowerCase().trim();
        const lastName = (contact.familyName || '').toLowerCase().trim();

        return fullName === query || firstName === query || lastName === query;
      });

      // If no exact match, fallback to substring match
      if (matches.length === 0) {
        matches = data.filter(contact => {
          const fullName = [contact.givenName, contact.familyName, contact.fullName]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return fullName.includes(query);
        });
      }

      if (matches.length > 0) {
        const match = matches[0];
        const rawNumber = match.phones && match.phones.length > 0
          ? match.phones[0].number || null
          : null;

        // Normalize the phone number (keep only digits and optional leading +)
        const cleanNumber = rawNumber ? rawNumber.replace(/[^\d+]/g, '') : null;

        return {
          name: match.fullName || `${match.givenName || ''} ${match.familyName || ''}`.trim(),
          number: cleanNumber
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
