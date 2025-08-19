import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import z from "zod";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useConvexQuery } from "@/hooks/use-convex-query";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { api } from "@/convex/_generated/api";

const groupSchema = z.object({
    name: z.string().min(1,"group name is required"),
    description: z.string().optional(),

})

const CreateGroupModal = ({ isOpen, onClose, isSuccess }) => {

    const [selectedMem, setSelectedMem] =  useState([]);
    const [searchQuery, setsearchQuery] = useState("");
    const [commandOpen, setcommandOpen] = useState(false);
    const {data:currentUser} = useConvexQuery(api.users.getCurrentUser);
    const {data:searchResults, isLoading: isSearching} = useConvexQuery(api.users.searchUsers);


  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm({
    resolver:zodResolver(groupSchema),
    defaultValues:{
        name:"",
        description:""
    }
  });

  const handleClose = () => {
    // resrting form function
    reset();

    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Group</DialogTitle>
        </DialogHeader>

        {/* we are using here react hook form by zod which is a very robust way to 
    create a form in react and validation purpose */}
        <form className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="name">Group Name</Label>
                <Input id="name" placeholder="enter group name"
                {...register("name")}
                />
                {/* if koi error hai error display kro */}
                {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
                <Label htmlFor="name">Description (optional)</Label>
                <Textarea id="description" placeholder="enter group description"
                {...register("description")}
                />
                {/* if koi error hai error display kro */}
                {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
                <Label>Members</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                   {currentUser && (
                <Badge variant="secondary" className="px-3 py-1">
                  <Avatar className="h-5 w-5 mr-2">
                    <AvatarImage src={currentUser.imageUrl} />
                    <AvatarFallback>
                      {currentUser.name?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span>{currentUser.name} (You)</span>
                </Badge>
              )} 
                </div>

                {/* selected members */}

                

            </div>

        </form>

        <DialogFooter>Footer</DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateGroupModal;
