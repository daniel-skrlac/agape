package hr.agape.user.mapper;

import hr.agape.user.domain.UserEntity;
import hr.agape.user.dto.UserDirectoryResponseDTO;
import org.mapstruct.Mapper;

@Mapper(componentModel = "cdi")
public interface UserDirectoryMapper {
    UserDirectoryResponseDTO toDto(UserEntity user);
}