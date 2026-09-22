<?php

namespace App\Filament\Resources\UserResponses;

use App\Filament\Resources\UserResponses\Pages\ListUserResponses;
use App\Filament\Resources\UserResponses\Schemas\UserResponseForm;
use App\Filament\Resources\UserResponses\Tables\UserResponsesTable;
use App\Models\UserResponse;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;

class UserResponseResource extends Resource
{
    protected static ?string $model = UserResponse::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    public static function form(Schema $schema): Schema
    {
        return UserResponseForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return UserResponsesTable::configure($table);
    }

    public static function getRelations(): array
    {
        return [
            //
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => ListUserResponses::route('/'),
        ];
    }

    public static function canCreate(): bool
    {
        return false;
    }

    public static function canEdit(Model $record): bool
    {
        return false;
    }

    public static function canDelete(Model $record): bool
    {
        return false;
    }
}
