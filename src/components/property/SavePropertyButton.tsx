import WishlistPickerDialog from "@/components/wishlist/WishlistPickerDialog";

interface SavePropertyButtonProps {
  propertyId: string;
  className?: string;
}

// Backwards-compatible wrapper — now opens the wishlist collection picker.
const SavePropertyButton = ({ propertyId }: SavePropertyButtonProps) => {
  return <WishlistPickerDialog propertyId={propertyId} />;
};

export default SavePropertyButton;
