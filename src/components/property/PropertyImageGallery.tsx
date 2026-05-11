
import { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, Share2, Heart } from "lucide-react";

interface PropertyImageGalleryProps {
  images: string[];
  title: string;
}

const PropertyImageGallery = ({ images, title }: PropertyImageGalleryProps) => {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const validImages = images && Array.isArray(images) && images.length > 0 
    ? images 
    : ["/placeholder.svg"];

  const handleImageError = (index: number) => {
    setImageErrors(prev => new Set([...prev, index]));
  };

  const getImageUrl = (imageUrl: string, index: number) => {
    if (imageErrors.has(index)) return "/placeholder.svg";
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return imageUrl;
    if (imageUrl.startsWith('/storage/')) return `https://gigzciepwjrwbljdnixh.supabase.co${imageUrl}`;
    if (imageUrl.startsWith('/')) return imageUrl;
    return "/placeholder.svg";
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const closeLightbox = () => setLightboxOpen(false);

  const goNext = useCallback(() => {
    setLightboxIndex(i => (i + 1) % validImages.length);
  }, [validImages.length]);

  const goPrev = useCallback(() => {
    setLightboxIndex(i => (i - 1 + validImages.length) % validImages.length);
  }, [validImages.length]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKey);
    };
  }, [lightboxOpen, goNext, goPrev]);

  return (
    <>
      <div className="space-y-4">
        <div className="relative cursor-pointer" onClick={() => openLightbox(selectedImageIndex)}>
          <img
            src={getImageUrl(validImages[selectedImageIndex], selectedImageIndex)}
            alt={title}
            fetchPriority="high"
            decoding="async"
            width={1200}
            height={800}
            className="w-full h-96 object-cover rounded-lg"
            onError={() => handleImageError(selectedImageIndex)}
          />
          <div className="absolute bottom-4 right-4 bg-black/50 text-white px-2 py-1 rounded text-sm">
            {selectedImageIndex + 1} / {validImages.length}
          </div>
        </div>
        
        {validImages.length > 1 && (
          <div className="flex gap-2 overflow-x-auto">
            {validImages.map((image, index) => (
              <img
                key={index}
                src={getImageUrl(image, index)}
                alt={`${title} ${index + 1}`}
                loading="lazy"
                decoding="async"
                width={80}
                height={80}
                className={`w-20 h-20 object-cover rounded cursor-pointer flex-shrink-0 ${
                  index === selectedImageIndex ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setSelectedImageIndex(index)}
                onError={() => handleImageError(index)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen Lightbox */}
      {lightboxOpen && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <button
              onClick={closeLightbox}
              className="flex items-center gap-2 text-sm font-medium hover:opacity-80 transition-opacity"
            >
              <X className="h-5 w-5" />
              <span>Close</span>
            </button>
            <span className="text-sm font-medium">
              {lightboxIndex + 1} / {validImages.length}
            </span>
            <div className="flex items-center gap-3">
              <button className="hover:opacity-80 transition-opacity">
                <Share2 className="h-5 w-5" />
              </button>
              <button className="hover:opacity-80 transition-opacity">
                <Heart className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Image area */}
          <div className="flex-1 flex items-center justify-center relative px-16">
            {validImages.length > 1 && (
              <button
                onClick={goPrev}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center text-white transition-colors"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}

            <img
              src={getImageUrl(validImages[lightboxIndex], lightboxIndex)}
              alt={`${title} ${lightboxIndex + 1}`}
              className="max-h-full max-w-full object-contain rounded-lg"
              onError={() => handleImageError(lightboxIndex)}
            />

            {validImages.length > 1 && (
              <button
                onClick={goNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center text-white transition-colors"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default PropertyImageGallery;
