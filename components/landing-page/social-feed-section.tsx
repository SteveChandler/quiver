"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { SectionWrapper } from "./section-wrapper";
import SocialPostCard from "@/components/social-post-card";
import { CONTENT } from "@/lib/constants/features";
import { fetchRecentPosts, Post } from "@/lib/utils/posts-utils";

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
    >
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {posts.map((post, index) => (
            <Link key={post.id} href="/auth/sign-up">
              <SocialPostCard
                id={post.id}
                name={post.name}
                activity={post.activity}
                imageUrl={post.imageUrl}
                avatar={post.avatar}
                index={index}
              />
            </Link>
          ))}
        </div>
      )}
    </SectionWrapper>
  );
}
