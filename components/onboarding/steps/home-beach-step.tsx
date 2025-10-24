'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { homeBeachSchema, HomeBeachFormData } from '@/lib/schemas/onboarding-schemas';
import { useOnboardingStore } from '@/store/onboarding-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin } from 'lucide-react';

interface Beach {
  id: string;
  name: string;
  region: string;
  country: string;
}

export function HomeBeachStep() {
  const { data, updateData, nextStep, prevStep } = useOnboardingStore();
  const [searchResults, setSearchResults] = useState<Beach[]>([]);
  const [selectedBeach, setSelectedBeach] = useState<Beach | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const {
    handleSubmit,
    setValue,
    formState: { errors, isValid },
  } = useForm<HomeBeachFormData>({
    resolver: zodResolver(homeBeachSchema),
    defaultValues: {
      homeBeachId: data.homeBeachId || '',
      homeBeachName: data.homeBeachName || '',
    },
  });

  const searchBeaches = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(`/api/beaches/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const beaches = await res.json();
        setSearchResults(beaches);
      }
    } catch (error) {
      console.error('Failed to search beaches:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const selectBeach = (beach: Beach) => {
    setSelectedBeach(beach);
    setValue('homeBeachId', beach.id, { shouldValidate: true });
    setValue('homeBeachName', beach.name, { shouldValidate: true });
    setSearchResults([]);
  };

  const onSubmit = (formData: HomeBeachFormData) => {
    updateData(formData);
    nextStep();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Where do you usually surf?</h2>
        <p className="text-gray-600 text-sm">
          We'll show you personalized forecasts for your home beach
        </p>
      </div>

      <div>
        <Label htmlFor="beachSearch">Search for your beach</Label>
        <div className="relative">
          <Input
            id="beachSearch"
            placeholder="e.g., Malibu, Pipeline, Rincon..."
            onChange={(e) => searchBeaches(e.target.value)}
            autoComplete="off"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="animate-spin h-4 w-4 border-2 border-ocean-blue border-t-transparent rounded-full" />
            </div>
          )}
          {searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {searchResults.map((beach) => (
                <button
                  key={beach.id}
                  type="button"
                  onClick={() => selectBeach(beach)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b last:border-b-0"
                >
                  <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <div>
                    <div className="font-medium">{beach.name}</div>
                    <div className="text-sm text-gray-500">
                      {beach.region}, {beach.country}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        {selectedBeach && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg flex items-center gap-2">
            <MapPin className="h-4 w-4 text-ocean-blue" />
            <span className="font-medium">{selectedBeach.name}</span>
          </div>
        )}
        {errors.homeBeachId && (
          <p className="text-sm text-red-600 mt-1" role="alert">
            {errors.homeBeachId.message}
          </p>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-sm text-amber-900">
          <strong>Tip:</strong> You can change your home beach anytime from your profile settings
        </p>
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={prevStep} className="flex-1">
          Back
        </Button>
        <Button type="submit" className="flex-1" disabled={!isValid}>
          Continue
        </Button>
      </div>
    </form>
  );
}
