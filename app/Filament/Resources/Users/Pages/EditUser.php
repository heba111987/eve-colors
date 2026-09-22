<?php

namespace App\Filament\Resources\Users\Pages;

use App\Filament\Resources\Users\UserResource;
use App\Models\User;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;
use Illuminate\Database\Eloquent\Model;

class EditUser extends EditRecord
{
    protected static string $resource = UserResource::class;

    protected function getHeaderActions(): array
    {
        return [
            DeleteAction::make(),
        ];
    }

    /**
     * Bypass mass assignment for is_admin, which is deliberately excluded
     * from User::$fillable (Task 2). This is safe because reaching this
     * page already requires canAccessPanel() to have returned true for the
     * current user — i.e. they're already an admin.
     */
    protected function handleRecordUpdate(Model $record, array $data): Model
    {
        /** @var User $record */
        $record->is_admin = (bool) ($data['is_admin'] ?? $record->is_admin);
        $record->save();

        return $record;
    }
}
