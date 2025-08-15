"use client"

import { Button } from '@/components/ui/button'
import { api } from '@/convex/_generated/api'
import { useConvexQuery } from '@/hooks/use-convex-query'
import { Plus, User } from 'lucide-react'
// import { useConvex, useQuery } from 'convex/react'
import React, { useState } from 'react'
import { BarLoader } from 'react-spinners'

const ContactsPage = () => {

    const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);

   const { data , isLoading } = useConvexQuery(api.contacts.getAllContacts); // API se saare contacts ka data fetch karo (real-time updates ke saath)
//    console.log(data);
    if(isLoading) {
        return (
            <div className='container mx-auto py-12'>
                <BarLoader width={"100%"} color='#36d7b7' />
            </div>
        )
    }

    const {user, groups} = data || {users:[], groups:[]};
   
   


  return (
    <div className='container mx-auto py-6'>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between mb-6">
        <h1 className="text-5xl gradient-title">Contacts</h1>
        <Button onClick={() => setIsCreateGroupModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Group
        </Button>
      </div>

        <div>
            {/* individual contact */}
            <div>
                <h2 className='text-xl font-bold mb-4 flex items-center'>
                    <User className='mr-2 h-5 w-5' />
                    People
                </h2>
            </div>


            {/* group contacts */}
            <div></div>
        </div>

    </div>
  );

}

export default ContactsPage