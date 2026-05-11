import React, { useState } from 'react';
import { Share2, Copy, Check, Facebook, Twitter, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

interface SharePropertyButtonProps {
  propertyId: string;
  shortCode?: string | null;
  title: string;
}

// Edge function URL for social sharing with full OG metadata
const SUPABASE_URL = 'https://gigzciepwjrwbljdnixh.supabase.co';

const SharePropertyButton: React.FC<SharePropertyButtonProps> = ({ 
  propertyId, 
  shortCode,
  title 
}) => {
  const [copied, setCopied] = useState(false);
  const { t } = useLanguage();

  // Generate the SEO-optimized share URL (edge function)
  // This URL serves full OG metadata to crawlers, then redirects to SPA
  const getShareUrl = () => {
    const identifier = shortCode || propertyId;
    const param = shortCode ? 'code' : 'id';
    return `${SUPABASE_URL}/functions/v1/og-image?${param}=${identifier}`;
  };

  const shareUrl = getShareUrl();

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success(t('share.link_copied') || 'Link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy link');
    }
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(`${title}\n${shareUrl}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleShareFacebook = () => {
    const url = encodeURIComponent(shareUrl);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
  };

  const handleShareTwitter = () => {
    const text = encodeURIComponent(title);
    const url = encodeURIComponent(shareUrl);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or share failed
      }
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="rounded-full">
          <Share2 className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleCopyLink} className="cursor-pointer">
          {copied ? (
            <Check className="h-4 w-4 mr-2 text-green-500" />
          ) : (
            <Copy className="h-4 w-4 mr-2" />
          )}
          {t('share.copy_link') || 'Copy link'}
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={handleShareWhatsApp} className="cursor-pointer">
          <MessageCircle className="h-4 w-4 mr-2 text-green-600" />
          WhatsApp
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={handleShareFacebook} className="cursor-pointer">
          <Facebook className="h-4 w-4 mr-2 text-blue-600" />
          Facebook
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={handleShareTwitter} className="cursor-pointer">
          <Twitter className="h-4 w-4 mr-2 text-sky-500" />
          Twitter
        </DropdownMenuItem>

        {typeof navigator !== 'undefined' && navigator.share && (
          <DropdownMenuItem onClick={handleNativeShare} className="cursor-pointer">
            <Share2 className="h-4 w-4 mr-2" />
            {t('share.more') || 'More options'}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default SharePropertyButton;