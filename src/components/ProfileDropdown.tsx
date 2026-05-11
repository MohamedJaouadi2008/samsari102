
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  User, 
  Settings, 
  LogOut, 
  MessageSquare, 
  Heart, 
  Home, 
  Shield, 
  Camera, 
  ClipboardList 
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";

const ProfileDropdown = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { unreadCount, markAllAsRead } = useUnreadMessages();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (error) {
        console.error('Profile fetch error:', error);
        if (error.code === 'PGRST116') {
          await createProfile();
        }
      } else {
        setProfile(data);
      }
    } catch (error) {
      console.error('Profile fetch error:', error);
    }
  };

  const createProfile = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          full_name: user.user_metadata?.full_name || '',
          avatar_url: user.user_metadata?.avatar_url || ''
        })
        .select()
        .single();
        
      if (error) {
        console.error('Profile creation error:', error);
      } else {
        setProfile(data);
      }
    } catch (error) {
      console.error('Profile creation error:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
      toast({
        title: "Signed out successfully",
        description: "You have been signed out of your account"
      });
    } catch (error) {
      console.error('Error signing out:', error);
      toast({
        title: "Error",
        description: "Failed to sign out",
        variant: "destructive"
      });
    }
  };

  const handleProfilePictureUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        console.error('Avatar upload error:', uploadError);
        toast({
          title: "Error",
          description: "Failed to upload profile picture",
          variant: "destructive"
        });
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) {
        console.error('Profile update error:', updateError);
        toast({
          title: "Error", 
          description: "Failed to update profile picture",
          variant: "destructive"
        });
        return;
      }

      setProfile(prev => ({ ...prev, avatar_url: publicUrl }));
      toast({
        title: "Success",
        description: "Profile picture updated successfully"
      });
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast({
        title: "Error",
        description: "Failed to upload profile picture",
        variant: "destructive"
      });
    }
  };

  if (!user) return null;

  const userInitial = profile?.full_name?.charAt(0) || user.email?.charAt(0)?.toUpperCase() || "U";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile?.avatar_url || ""} alt="Profile" />
            <AvatarFallback>{userInitial}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <div className="flex items-center justify-start gap-2 p-2">
          <div className="flex flex-col space-y-1 leading-none">
            <p className="font-medium">{profile?.full_name || "User"}</p>
            <p className="w-[200px] truncate text-sm text-muted-foreground">
              {user.email}
            </p>
          </div>
        </div>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem asChild>
          <Link to="/profile" className="flex items-center">
            <User className="mr-2 h-4 w-4" />
            Profile
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuItem asChild>
          <Link to="/profile?tab=properties" className="flex items-center">
            <Home className="mr-2 h-4 w-4" />
            My Properties
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuItem asChild>
          <Link to="/wishlists" className="flex items-center">
            <Heart className="mr-2 h-4 w-4" />
            My Wishlists
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuItem asChild>
          <Link to="/profile?tab=inbox" className="flex items-center" onClick={markAllAsRead}>
            <MessageSquare className="mr-2 h-4 w-4" />
            Messages
            {unreadCount > 0 && (
              <Badge variant="default" className="ml-auto">
                {unreadCount}
              </Badge>
            )}
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuItem asChild>
          <Link to="/profile?tab=requests" className="flex items-center">
            <ClipboardList className="mr-2 h-4 w-4" />
            Requests
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuItem asChild>
          <Link to="/profile?tab=verification" className="flex items-center">
            <Shield className="mr-2 h-4 w-4" />
            Verification
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem>
          <label htmlFor="avatar-upload" className="flex items-center cursor-pointer w-full">
            <Camera className="mr-2 h-4 w-4" />
            Change Photo
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              onChange={handleProfilePictureUpload}
              className="hidden"
            />
          </label>
        </DropdownMenuItem>
        
        <DropdownMenuItem asChild>
          <Link to="/profile?tab=settings" className="flex items-center">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ProfileDropdown;
