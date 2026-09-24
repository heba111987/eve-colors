<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('analytics_consent_at')->nullable()->after('consent_accepted_at');
            $table->timestamp('marketing_consent_at')->nullable()->after('analytics_consent_at');
        });

        // The old combined flag only ever meant "analytics" in practice (the
        // consent screen had no separate marketing toggle yet), so it carries
        // forward as analytics consent only — nobody has agreed to marketing
        // email under the old single checkbox.
        DB::table('users')
            ->whereNotNull('analytics_marketing_consent_at')
            ->update(['analytics_consent_at' => DB::raw('analytics_marketing_consent_at')]);

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('analytics_marketing_consent_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('analytics_marketing_consent_at')->nullable()->after('consent_accepted_at');
        });

        DB::table('users')
            ->whereNotNull('analytics_consent_at')
            ->update(['analytics_marketing_consent_at' => DB::raw('analytics_consent_at')]);

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['analytics_consent_at', 'marketing_consent_at']);
        });
    }
};
