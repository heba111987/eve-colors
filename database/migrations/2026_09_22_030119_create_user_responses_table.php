<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_responses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('color_id')->constrained();
            $table->foreignId('question_id')->constrained();
            $table->text('answer_text')->nullable();
            $table->foreignId('activity_id')->nullable()->constrained();
            $table->boolean('activity_completed')->default(false);
            $table->date('entry_date');
            $table->decimal('flower_x', 5, 2)->nullable();
            $table->decimal('flower_y', 5, 2)->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'entry_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_responses');
    }
};
