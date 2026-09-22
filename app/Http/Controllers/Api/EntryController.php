<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResponseResource;
use App\Models\UserResponse;
use App\Services\ActivitySelector;
use App\Services\FlowerPlacer;
use App\Services\QuestionSelector;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class EntryController extends Controller
{
    public function today(Request $request): JsonResponse
    {
        $entry = UserResponse::where('user_id', $request->user()->id)
            ->whereDate('entry_date', now()->toDateString())
            ->first();

        return response()->json(['entry' => $entry ? new UserResponseResource($entry) : null]);
    }

    public function store(Request $request, QuestionSelector $questionSelector): JsonResponse
    {
        $data = $request->validate(['color_id' => ['required', 'integer', 'exists:colors,id']]);
        $user = $request->user();
        $today = now()->toDateString();

        $existing = UserResponse::where('user_id', $user->id)->whereDate('entry_date', $today)->exists();
        if ($existing) {
            return response()->json(['error' => 'entry_already_exists_today'], 409);
        }

        $question = $questionSelector->pick($user);

        $entry = UserResponse::create([
            'user_id' => $user->id,
            'color_id' => $data['color_id'],
            'question_id' => $question->id,
            'entry_date' => $today,
        ]);

        return response()->json(['entry' => new UserResponseResource($entry)], 201);
    }

    public function update(
        Request $request,
        int $id,
        ActivitySelector $activitySelector,
        FlowerPlacer $flowerPlacer,
    ): JsonResponse {
        $entry = UserResponse::where('id', $id)->where('user_id', $request->user()->id)->first();
        if (! $entry) {
            return response()->json(['error' => 'not_found'], 404);
        }

        if ($request->has('answer')) {
            if ($entry->answer_text !== null) {
                return response()->json(['error' => 'already_answered'], 409);
            }

            $data = $request->validate(['answer' => ['required', 'string']]);
            $activity = $activitySelector->pick();

            $entry->update(['answer_text' => $data['answer'], 'activity_id' => $activity->id]);

            return response()->json(['entry' => new UserResponseResource($entry->fresh())]);
        }

        if ($request->boolean('activityCompleted')) {
            if (! $entry->activity_id) {
                return response()->json(['error' => 'no_activity_assigned'], 409);
            }

            [$x, $y] = $flowerPlacer->place($request->user());
            $entry->update([
                'activity_completed' => true,
                'completed_at' => now(),
                'flower_x' => $x,
                'flower_y' => $y,
            ]);

            return response()->json(['entry' => new UserResponseResource($entry->fresh())]);
        }

        return response()->json(['error' => 'no_recognized_update'], 400);
    }

    public function rerollActivity(Request $request, int $id, ActivitySelector $activitySelector): JsonResponse
    {
        $entry = UserResponse::where('id', $id)->where('user_id', $request->user()->id)->first();
        if (! $entry) {
            return response()->json(['error' => 'not_found'], 404);
        }
        if ($entry->activity_completed) {
            return response()->json(['error' => 'activity_already_completed'], 409);
        }
        if (! $entry->activity_id) {
            return response()->json(['error' => 'no_activity_assigned_yet'], 409);
        }

        $activity = $activitySelector->pick($entry->activity_id);
        $entry->update(['activity_id' => $activity->id]);

        return response()->json([
            'activity' => ['id' => $activity->id, 'text' => $activity->text, 'quadrant' => $activity->quadrant->value],
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $limit = 20;
        $query = UserResponse::where('user_id', $request->user()->id)->orderByDesc('id');

        if ($cursor = $request->query('cursor')) {
            $query->where('id', '<', $cursor);
        }

        $rows = $query->limit($limit + 1)->get();
        $hasMore = $rows->count() > $limit;
        $page = $hasMore ? $rows->slice(0, $limit) : $rows;

        return response()->json([
            'entries' => UserResponseResource::collection($page->values()),
            'nextCursor' => $hasMore ? (string) $page->last()->id : null,
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $deleted = UserResponse::where('id', $id)->where('user_id', $request->user()->id)->delete();

        if ($deleted === 0) {
            return response()->json(['error' => 'not_found'], 404);
        }

        return response()->json(['ok' => true]);
    }
}
