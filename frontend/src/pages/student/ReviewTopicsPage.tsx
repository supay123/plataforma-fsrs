import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, EmptyState, PageHeader } from "../../components/ui";
import { Skeleton } from "../../components/ui/skeleton";
import { topicAccess, topicDueReviews } from "../../features/progress/api";
import { topicsToReview } from "../../features/progress/topic-review";

function ReviewSkeleton() {
  return <div aria-busy="true">
    <Skeleton height={36} width="16rem" />
    <Skeleton className="mt-3" height={16} width="22rem" />
    <div className="mt-8 grid gap-4 @xl:grid-cols-2 @4xl:grid-cols-3">{[0, 1, 2].map((item) => <Skeleton key={item} height={90} rounded="2xl" />)}</div>
  </div>;
}

export function StudentReviewTopicsPage() {
  const dueReviews = useQuery({ queryKey: ["topic-due-reviews"], queryFn: topicDueReviews });
  const access = useQuery({ queryKey: ["topic-access", "all"], queryFn: () => topicAccess() });
  if (dueReviews.isLoading || access.isLoading) return <ReviewSkeleton />;
  const topics = topicsToReview(dueReviews.data ?? [], access.data ?? []);
  return <div className="grid grid-cols-1 gap-6">
    <Link to="/estudiante" className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-fg-muted transition hover:text-fg"><ChevronLeft size={16} />Mi aprendizaje</Link>
    <PageHeader className="mb-0! portal:mb-0!" title="Temas por repasar" description="Temas con preguntas que ya te toca repasar según tu ritmo de memoria, del más atrasado al más reciente." />
    {topics.length ? <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2 @4xl:grid-cols-3">{topics.map((topic) => <Link key={topic.topicId} to={`/estudiante/temas/${topic.topicId}/sesion`} className="block min-w-0 rounded-2xl">
      <Card className="h-full p-4 transition hover:border-primary active:translate-y-0.5">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="type-heading truncate text-lg">{topic.topicName}</h2>
            <p className="truncate text-sm text-fg-muted">{topic.courseName}</p>
          </div>
          <ChevronRight size={18} className="shrink-0 text-fg-faint" />
        </div>
        <p className="mt-3 text-sm text-fg-muted"><span className="font-semibold tabular-nums text-primary-text">{topic.dueQuestions}</span> {topic.dueQuestions === 1 ? "pregunta por repasar" : "preguntas por repasar"}</p>
      </Card>
    </Link>)}</div>
      : <EmptyState>No tienes preguntas por repasar ahora. Vuelve más tarde: se programan según lo que vas respondiendo.</EmptyState>}
  </div>;
}
