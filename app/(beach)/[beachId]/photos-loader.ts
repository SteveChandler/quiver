import { createClient } from '@/utils/supabase/server';

type BeachPhoto = {
  image_url: string;
  thumb_url: string | null;
  attribution_html: string | null;
};

export async function getBeachPhotos(beachId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('beach_photos')
    .select('image_url, thumb_url, attribution_html')
    .eq('beach_id', beachId)
    .eq('approved', true)
    .order('fetched_at', { ascending: false })
    .limit(12);

  if (error) {
    throw error;
  }

  return (data as BeachPhoto[]) ?? [];
}
