import React, { useState, useRef } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Camera, X, Upload, Loader2, CheckCircle } from 'lucide-react';
import { cn } from "@/lib/utils";

interface EvidencePhotoUploadProps {
  bookingId: string;
  uploadType: 'dispute-evidence' | 'damage-claims';
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  minPhotos?: number;
  maxPhotos?: number;
  disabled?: boolean;
}

const EvidencePhotoUpload: React.FC<EvidencePhotoUploadProps> = ({
  bookingId,
  uploadType,
  photos,
  onPhotosChange,
  minPhotos = 1,
  maxPhotos = 5,
  disabled = false
}) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = maxPhotos - photos.length;
    if (remainingSlots <= 0) {
      toast({
        title: t('evi.max_reached'),
        description: t('evi.max_reached_desc', { count: maxPhotos }),
        variant: "destructive"
      });
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    setUploading(true);

    const uploadedUrls: string[] = [];

    for (const file of filesToUpload) {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: t('evi.invalid_type'),
          description: t('evi.invalid_type_desc', { name: file.name }),
          variant: "destructive"
        });
        continue;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: t('evi.too_large'),
          description: t('evi.too_large_desc', { name: file.name }),
          variant: "destructive"
        });
        continue;
      }

      try {
        setUploadProgress(prev => ({ ...prev, [file.name]: true }));

        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const base64Data = result.split(',')[1];
            resolve(base64Data);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileName = `${timestamp}_${sanitizedName}`;
        const bucketPath = `${uploadType}/${bookingId}`;

        const { data, error } = await supabase.functions.invoke('upload-to-r2', {
          body: { file: base64, fileName, contentType: file.type, bucketPath }
        });

        if (error) throw error;
        if (data?.url) uploadedUrls.push(data.url);

        setUploadProgress(prev => ({ ...prev, [file.name]: false }));
      } catch (error: any) {
        console.error('Upload error:', error);
        toast({
          title: t('evi.upload_failed'),
          description: error.message || t('evi.upload_failed_desc', { name: file.name }),
          variant: "destructive"
        });
        setUploadProgress(prev => ({ ...prev, [file.name]: false }));
      }
    }

    if (uploadedUrls.length > 0) {
      onPhotosChange([...photos, ...uploadedUrls]);
      toast({
        title: t('evi.uploaded'),
        description: t('evi.uploaded_desc', { count: uploadedUrls.length })
      });
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePhoto = (index: number) => {
    onPhotosChange(photos.filter((_, i) => i !== index));
  };

  const isValid = photos.length >= minPhotos;

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-4 text-center transition-colors",
          disabled ? "border-muted bg-muted/30 cursor-not-allowed" : "border-muted-foreground/30 hover:border-primary/50 cursor-pointer",
          photos.length >= maxPhotos && "opacity-50 cursor-not-allowed"
        )}
        onClick={() => !disabled && photos.length < maxPhotos && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || photos.length >= maxPhotos}
        />
        
        <div className="flex flex-col items-center gap-2">
          {uploading ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">{t('evi.uploading')}</span>
            </>
          ) : (
            <>
              <Camera className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium">
                {photos.length >= maxPhotos 
                  ? t('evi.max_label', { count: maxPhotos })
                  : t('evi.click_upload')}
              </span>
              <span className="text-xs text-muted-foreground">{t('evi.formats')}</span>
            </>
          )}
        </div>
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((url, index) => (
            <div key={index} className="relative aspect-square">
              <img src={url} alt={`Evidence ${index + 1}`} className="w-full h-full object-cover rounded-lg" />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 shadow-md hover:bg-destructive/90"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 text-sm">
        {isValid ? (
          <div className="flex items-center gap-1 text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span>{t('evi.uploaded_count', { count: photos.length })}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-destructive">
            <Upload className="h-4 w-4" />
            <span>{t('evi.min_required', { count: minPhotos })}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default EvidencePhotoUpload;
