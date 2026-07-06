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
    let permissionGranted = hasContactsPermission;
    if (!permissionGranted) {
      try {
        const { status } = await Contacts.requestPermissionsAsync();
        permissionGranted = status === 'granted';
        setHasContactsPermission(permissionGranted);
        if (!permissionGranted) return null;
      } catch (e) {
        return null;
      }
    }

    try {
      // Retrieve contacts with phone numbers
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers],
      });

      if (!data || data.length === 0) return null;

      const query = name.toLowerCase().trim();
      
      // Filter contacts matching the name query
      const matches = data.filter(contact => {
        const fullName = [contact.firstName, contact.lastName, contact.name]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return fullName.includes(query);
      });

      if (matches.length > 0) {
        const match = matches[0];
        const number = match.phoneNumbers && match.phoneNumbers.length > 0
          ? match.phoneNumbers[0].number || null
          : null;
        
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
