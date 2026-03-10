"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { SectionWrapper } from "./section-wrapper";
import SocialPostCard from "@/components/social-post-card";
import { CONTENT } from "@/lib/constants/features";
import { fetchRecentPosts, Post } from "@/lib/utils/posts-utils";
import { Users, TrendingUp, Clock, Waves } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { preserveQueryParams } from "@/lib/utils/navigation-utils";
import { Button } from "@/components/ui/button";

export function SocialFeedSection() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const isTest =
    typeof window !== "undefined" && (window as any).__PLAYWRIGHT__ === true;

  useEffect(() => {
    const loadPosts = async () => {
      try {
        const posts = await fetchRecentPosts();
        setPosts(posts);
      } catch (e) {
        // Swallow errors in test mode to avoid noisy console errors
        if (!isTest) {
          console.error(e);
        }
        setPosts([]);
      } finally {
        setLoading(false);
      }
    };
    loadPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SectionWrapper
      title={CONTENT.sections.social.title}
      subtitle={CONTENT.sections.social.subtitle}
      centerContent
      className="py-20 px-4 bg-[#252D6B]"
      titleClassName="text-4xl md:text-5xl font-heading font-bold text-white mb-4"
      subtitleClassName="text-xl font-sans text-high max-w-2xl mx-auto"
    >
      {/* Community Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="grid grid-cols-3 gap-6 mb-12 max-w-2xl mx-auto"
      >
        <div className="text-center">
          <div className="flex items-center justify-center w-12 h-12 bg-[#354090] rounded-full mx-auto mb-2">
            <Waves className="h-6 w-6 text-neon-cyan" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">1,200+</div>
          <div className="text-sm text-medium">Beaches Scored</div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center w-12 h-12 bg-[#354090] rounded-full mx-auto mb-2">
            <TrendingUp className="h-6 w-6 text-neon-orange" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">30K+</div>
          <div className="text-sm text-medium">Observations Analyzed</div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center w-12 h-12 bg-[#354090] rounded-full mx-auto mb-2">
            <Clock className="h-6 w-6 text-neon-magenta" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">Every 3hrs</div>
          <div className="text-sm text-medium">Updated</div>
        </div>
      </motion.div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="aspect-square bg-[#354090] rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : posts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {posts.map((post, index) => (
            <Link
              key={post.id}
              href={preserveQueryParams("/auth/sign-up", searchParams)}
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="transform hover:scale-105 transition-transform duration-300"
              >
                <SocialPostCard
                  id={post.id}
                  name={post.name}
                  activity={post.activity}
                  imageUrl={post.imageUrl}
                  avatar={post.avatar}
                  index={index}
                />
              </motion.div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center text-medium mb-8">
          No recent posts yet. Be the first to share!
        </div>
      )}

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="text-center"
      >
        <p className="text-high mb-4 font-sans">
          Want to share your next epic session?
        </p>
        <Button size="lg" className="rounded-full" asChild>
          <Link href={preserveQueryParams("/auth/sign-up", searchParams)}>
            Join the Community
            <Users className="h-4 w-4" />
          </Link>
        </Button>
      </motion.div>
    </SectionWrapper>
  );
}
