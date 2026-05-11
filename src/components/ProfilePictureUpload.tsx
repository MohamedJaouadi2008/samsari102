
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ProfilePictureUploadProps {
  currentAvatarUrl?: string;
  userInitial: string;
  userId: string;
  onAvatarUpdate: (newUrl: string) => void;
}

const ProfilePictureUpload = ({ 
  currentAvatarUrl, 
  userInitial, 
  userId, 
  onAvatarUpdate 
}: ProfilePictureUploadProps) => {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  const compressImage = (file: File, maxWidth: number = 800, quality: number = 0.8): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        
        // Draw and compress
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          }
        }, 'image/jpeg', quality);
      };
      
      img.src = URL.createObjectURL(file);
    });
  };

  const uploadAvatar = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    try {
      // Compress the image
      const compressedFile = await compressImage(file, 800, 0.7);
      
      const fileExt = 'jpg';
      const fileName = `avatar-${Date.now()}.${fileExt}`;

      // Convert to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(compressedFile);
      });

      const base64File = await base64Promise;

      // Upload to R2
      const { data, error } = await supabase.functions.invoke('upload-to-r2', {
        body: {
          file: base64File,
          fileName,
          contentType: 'image/jpeg',
          bucketPath: `avatars/${userId}`
        }
      });

      if (error) throw error;
      
      const avatarUrl = data.url;

      // Update profile in profiles table
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', userId);

      if (updateError) {
        console.error('Profile update error:', updateError);
        throw updateError;
      }

      onAvatarUpdate(avatarUrl);
      toast({
        title: "Success",
        description: "Profile picture updated successfully"
      });
    } catch (error: any) {
      console.error('Avatar upload error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload profile picture",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file type",
          description: "Please select an image file",
          variant: "destructive"
        });
        return;
      }
      
      uploadAvatar(file);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative">
        <Avatar className="h-24 w-24">
          <AvatarImage src={currentAvatarUrl} />
          <AvatarFallback className="text-2xl">
            {userInitial}
          </AvatarFallback>
        </Avatar>
        <div className="absolute -bottom-2 -right-2">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            id="avatar-upload"
            disabled={uploading}
          />
          <label htmlFor="avatar-upload">
            <Button
              size="sm"
              className="rounded-full h-8 w-8 p-0"
              disabled={uploading}
              asChild
            >
              <span>
                {uploading ? (
                  <Upload className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </span>
            </Button>
          </label>
        </div>
      </div>
      <p className="text-sm text-gray-600 text-center">
        Click the camera icon to upload a profile picture
        <br />
        <span className="text-xs text-muted-foreground">
          Image will be compressed automatically for optimal quality
        </span>
      </p>
    </div>
  );
};

export default ProfilePictureUpload;
