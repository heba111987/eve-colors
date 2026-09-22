<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('google_id')->nullable()->unique()->after('email');
            $table->string('avatar_url')->nullable()->after('google_id');
            $table->timestamp('consent_accepted_at')->nullable()->after('avatar_url');
            $table->timestamp('analytics_marketing_consent_at')->nullable()->after('consent_accepted_at');
            $table->boolean('is_admin')->default(false)->after('analytics_marketing_consent_at');
            $table->string('password')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['google_id', 'avatar_url', 'consent_accepted_at', 'analytics_marketing_consent_at', 'is_admin']);
            $table->string('password')->nullable(false)->change();
        });
    }
};
