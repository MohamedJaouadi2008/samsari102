import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, X, Image, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

interface PropertyPhotosProps {
  data: any;
  onUpdate: (data: any) => void;
}

const PropertyPhotos = ({ data, onUpdate }: PropertyPhotosProps) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const { toast } = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    const getUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    getUserId();
  }, []);

  const requiredPhotoTypes = [
    { id: 'exterior', label: t('photos.exterior'), required: true },
    { id: 'kitchen', label: t('photos.kitchen'), required: true },
    { id: 'bathroom', label: t('photos.bathroom'), required: true },
    { id: 'living_room', label: t('photos.living_room'), required: true }
  ];

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent, photoType?: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files, photoType);
    }
  };

  const uploadToSupabase = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      // Convert to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(file);
      });

      const base64File = await base64Promise;

      // Upload to R2
      const { data: uploadData, error } = await supabase.functions.invoke('upload-to-r2', {
        body: {
          file: base64File,
          fileName,
          contentType: file.type,
          bucketPath: `property-photos/${userId}`
        }
      });

      if (error) throw error;
      return uploadData.url;
    } catch (error) {
      console.error('Error uploading to R2:', error);
      return null;
    }
  };

  const handleFiles = async (files: FileList, photoType?: string) => {
    setUploading(true);
    const newPhotos = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
          toast({
            title: t('photos.invalid_type'),
            description: t('photos.invalid_type_desc', { name: file.name }),
            variant: "destructive"
          });
          continue;
        }

        if (file.size > 10 * 1024 * 1024) {
          toast({
            title: t('photos.too_large'),
            description: t('photos.too_large_desc', { name: file.name }),
            variant: "destructive"
          });
          continue;
        }

        console.log('Processing file:', file.name, 'Type:', photoType);

        const uploadedUrl = await uploadToSupabase(file);
        
        if (uploadedUrl) {
          newPhotos.push({
            url: uploadedUrl,
            preview: URL.createObjectURL(file),
            name: file.name,
            type: photoType || 'general'
          });
        } else {
          toast({
            title: t('photos.upload_fail'),
            description: t('photos.upload_fail_desc', { name: file.name }),
            variant: "destructive"
          });
        }
      }

      if (newPhotos.length > 0) {
        const currentPhotos = data.photos || [];
        const updatedPhotos = [...currentPhotos, ...newPhotos];
        onUpdate({ photos: updatedPhotos });
        
        toast({
          title: t('photos.uploaded_ok'),
          description: t('photos.uploaded_ok_desc', { count: newPhotos.length })
        });
      }
    } catch (error) {
      console.error('Error handling files:', error);
      toast({
        title: t('photos.upload_error'),
        description: t('photos.upload_error_desc'),
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (index: number) => {
    const currentPhotos = data.photos || [];
    const updatedPhotos = currentPhotos.filter((_: any, i: number) => i !== index);
    onUpdate({ photos: updatedPhotos });
  };

  const getPhotosByType = (type: string) => {
    return (data.photos || []).filter((photo: any) => photo.type === type);
  };

  const getBedroomPhotos = () => {
    return (data.photos || []).filter((photo: any) => photo.type?.startsWith('bedroom_'));
  };

  const missingRequiredPhotos = requiredPhotoTypes.filter(type => 
    getPhotosByType(type.id).length === 0
  );

  const bedroomCount = data.bedrooms || 1;
  const bedroomPhotos = getBedroomPhotos();
  const missingBedroomPhotos = bedroomCount - new Set(bedroomPhotos.map((p: any) => p.type)).size;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">{t('photos.upload_title')}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {t('photos.upload_desc')}
        </p>
        
        {(missingRequiredPhotos.length > 0 || missingBedroomPhotos > 0) && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {t('photos.missing_required_inline')}
              {missingRequiredPhotos.length > 0 && (
                <span> {missingRequiredPhotos.map(p => p.label).join(', ')}</span>
              )}
              {missingBedroomPhotos > 0 && (
                <span> {t('photos.bedroom_photos_missing', { count: missingBedroomPhotos })}</span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {uploading && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {t('photos.uploading')}
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Required Room Photos */}
      <div className="grid md:grid-cols-2 gap-4">
        {requiredPhotoTypes.map((photoType) => (
          <Card key={photoType.id} className="border-2 border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                {photoType.label}
                <span className="text-xs text-muted-foreground">
                  {getPhotosByType(photoType.id).length > 0 ? '✓' : t('photos.required')}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {getPhotosByType(photoType.id).length > 0 ? (
                <div className="space-y-2">
                  {getPhotosByType(photoType.id).map((photo: any, index: number) => (
                    <div key={index} className="relative group">
                      <img
                        src={photo.preview || photo.url}
                        alt={photoType.label}
                        className="w-full h-20 object-cover rounded"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removePhoto((data.photos || []).indexOf(photo))}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className="flex flex-col items-center justify-center py-6 cursor-pointer"
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={(e) => handleDrop(e, photoType.id)}
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.multiple = true;
                    input.onchange = (e) => {
                      const target = e.target as HTMLInputElement;
                      if (target.files) handleFiles(target.files, photoType.id);
                    };
                    input.click();
                  }}
                >
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-xs text-center">{t('photos.click_drag')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bedroom Photos */}
      {bedroomCount > 0 && (
        <div>
          <h4 className="font-medium mb-3">{t('photos.bedroom_section')}</h4>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: bedroomCount }, (_, index) => {
              const bedroomType = `bedroom_${index + 1}`;
              const bedroomPhotosForRoom = getPhotosByType(bedroomType);
              
              return (
                <Card key={bedroomType} className="border-2 border-dashed">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      {t('photos.bedroom_n', { n: index + 1 })}
                      <span className="text-xs text-muted-foreground">
                        {bedroomPhotosForRoom.length > 0 ? '✓' : t('photos.required')}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {bedroomPhotosForRoom.length > 0 ? (
                      <div className="relative group">
                        <img
                          src={bedroomPhotosForRoom[0].preview || bedroomPhotosForRoom[0].url}
                          alt={`Bedroom ${index + 1}`}
                          className="w-full h-20 object-cover rounded"
                        />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removePhoto((data.photos || []).indexOf(bedroomPhotosForRoom[0]))}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div
                        className="flex flex-col items-center justify-center py-6 cursor-pointer"
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.onchange = (e) => {
                            const target = e.target as HTMLInputElement;
                            if (target.files) handleFiles(target.files, bedroomType);
                          };
                          input.click();
                        }}
                      >
                        <Upload className="h-6 w-6 text-muted-foreground mb-2" />
                        <p className="text-xs text-center">{t('photos.add_bedroom')}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Additional Photos */}
      <Card
        className={`border-2 border-dashed transition-colors ${
          dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={(e) => handleDrop(e, 'general')}
      >
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Upload className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-2">{t('photos.add_more')}</p>
          <p className="text-sm text-muted-foreground mb-4">{t('photos.size_limit')}</p>
          <Button
            variant="outline"
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/*';
              input.multiple = true;
              input.onchange = (e) => {
                const target = e.target as HTMLInputElement;
                if (target.files) handleFiles(target.files, 'general');
              };
              input.click();
            }}
            disabled={uploading}
          >
            {uploading ? t('photos.uploading_btn') : t('photos.choose_files')}
          </Button>
        </CardContent>
      </Card>

      {/* All Photos Grid */}
      {data.photos && data.photos.length > 0 && (
        <div>
          <h4 className="font-medium mb-3">{t('photos.all_photos', { count: data.photos.length })}</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {data.photos.map((photo: any, index: number) => (
              <Card key={index} className="relative group">
                <CardContent className="p-2">
                  <div className="aspect-square relative">
                    <img
                      src={photo.preview || photo.url}
                      alt={`Property photo ${index + 1}`}
                      className="w-full h-full object-cover rounded"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removePhoto(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                      {photo.type === 'general' ? t('photos.general') : photo.type.replace('_', ' ')}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {(!data.photos || data.photos.length === 0) && (
        <Card className="border border-muted">
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <Image className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">{t('photos.none_yet')}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PropertyPhotos;
