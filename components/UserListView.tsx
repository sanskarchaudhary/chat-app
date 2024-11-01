import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, getFirestore, addDoc } from 'firebase/firestore';
import { UserPlus, MessageSquarePlus, Search } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@radix-ui/react-avatar';

interface User {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
}

export const UserListView = ({ currentUser, onMessageRequest }: { 
  currentUser: User, 
  onMessageRequest: (userId: string) => void 
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);

  // Initialize Firebase services

  const db = getFirestore();

  useEffect(() => {
    const fetchUsers = async () => {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('uid', '!=', currentUser.uid));
      const querySnapshot = await getDocs(q);
      const usersList = querySnapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      } as User));
      setUsers(usersList);
      setFilteredUsers(usersList);
    };

    fetchUsers();
  }, [currentUser, db]);

  useEffect(() => {
    const filtered = users.filter(user => 
      user.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredUsers(filtered);
  }, [searchQuery, users]);

    async function handleAddFriend(uid: string): Promise<void> {
        try {
            const friendRef = collection(db, 'friends');
            await addDoc(friendRef, {
                userId: currentUser.uid,
                friendId: uid,
                createdAt: new Date()
            });
            alert('Friend added successfully!');
        } catch (error) {
            console.error('Error adding friend: ', error);
            alert('Failed to add friend.');
        }
    }

  return (
    <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <Input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 w-full"
          />
        </div>
      </div>
      
      <ScrollArea className="h-[400px] p-4">
        <AnimatePresence>
          {filteredUsers.map((user) => (
            <motion.div
              key={user.uid}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex items-center justify-between p-3 mb-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <div className="flex items-center space-x-3">
                <Avatar>
                  <AvatarImage src={user.photoURL} />
                  <AvatarFallback>
                    {user.displayName?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{user.displayName}</p>
                  <p className="text-sm text-gray-500">{user.email}</p>
                </div>
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onMessageRequest(user.uid)}
                  className="hover:bg-purple-100 dark:hover:bg-purple-900"
                >
                  <MessageSquarePlus className="h-5 w-5 text-purple-500" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleAddFriend(user.uid)}
                  className="hover:bg-green-100 dark:hover:bg-green-900"
                >
                  <UserPlus className="h-5 w-5 text-green-500" />
                </Button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </ScrollArea>
    </div>
  );
}; 