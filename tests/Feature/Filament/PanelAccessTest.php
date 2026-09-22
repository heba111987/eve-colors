<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('denies panel access to a non-admin user', function () {
    // No need to pass is_admin explicitly — the users.is_admin column
    // defaults to false (Task 2's migration), and passing it here would hit
    // the same fillable restriction the admin() factory state works around.
    $user = User::factory()->create();
    $this->actingAs($user);

    $response = $this->get('/admin');

    $response->assertForbidden();
});

it('grants panel access to an admin user', function () {
    $admin = User::factory()->admin()->create();
    $this->actingAs($admin);

    $response = $this->get('/admin');

    $response->assertOk();
});
