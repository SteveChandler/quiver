"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { SectionWrapper } from "./section-wrapper";
import SocialPostCard from "@/components/social-post-card";
import { CONTENT } from "@/lib/constants/features";
import { fetchRecentPosts, Post } from "@/lib/utils/posts-utils";
import { Users, TrendingUp, Heart } from "lucide-react";

export function SocialFeedSection() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPosts = async () => {
      const posts = await fetchRecentPosts();
      setPosts(posts);
      setLoading(false);
    };
    loadPosts();
  }, []);

  return (
    <SectionWrapper
      title={CONTENT.sections.social.title}
      subtitle={CONTENT.sections.social.subtitle}
      centerContent
      className="py-20 px-4"
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
          <div className="flex items-center justify-center w-12 h-12 bg-ocean-blue/10 rounded-full mx-auto mb-2">
            <Users className="h-6 w-6 text-ocean-blue" />
          </div>
          <div className="text-2xl font-bold text-gray-900">1,000+</div>
          <div className="text-sm text-gray-600">Active Surfers</div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center w-12 h-12 bg-sunset-orange/10 rounded-full mx-auto mb-2">
            <TrendingUp className="h-6 w-6 text-sunset-orange" />
          </div>
          <div className="text-2xl font-bold text-gray-900">5,000+</div>
          <div className="text-sm text-gray-600">Sessions Logged</div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center w-12 h-12 bg-green-500/10 rounded-full mx-auto mb-2">
            <Heart className="h-6 w-6 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">15,000+</div>
          <div className="text-sm text-gray-600">Connections Made</div>
        </div>
      </motion.div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="aspect-square bg-gray-200 rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {posts.map((post, index) => (
            <Link key={post.id} href="/auth/sign-up">
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
      )}

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="text-center"
      >
        <p className="text-gray-600 mb-4">
          Want to share your next epic session?
        </p>
        <Link
          href="/auth/sign-up"
          className="inline-flex items-center gap-2 bg-ocean-blue text-white px-6 py-3 rounded-full font-semibold hover:bg-ocean-blue/90 transition-colors"
        >
          Join the Community
          <Users className="h-4 w-4" />
        </Link>
      </motion.div>
    </SectionWrapper>
  );
}
